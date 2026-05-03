import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { User } from './user.entity';
import { Follow } from './follow.entity';
import { FollowRequest } from './follow-request.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BlocksService } from './blocks.service';
import { ContentFilterService } from '../../common/content-filter/content-filter.service';

export interface PublicProfile {
  id: string;
  username: string;
  skillLevel: string;
  position: string;
  club: string | null;
  competition: string | null;
  league: string | null;
  profilePicture: string | null;
  bio: string | null;
  createdAt: Date;
  followersCount: number;
  followingCount: number;
}

export interface PublicProfileWithStatus extends PublicProfile {
  isFollowing: boolean;
  outgoingFollowRequestPending?: boolean;
  incomingFollowRequestPending?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(FollowRequest)
    private readonly followRequestRepo: Repository<FollowRequest>,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
    private readonly blocksService: BlocksService,
    private readonly contentFilter: ContentFilterService,
  ) {}

  private profileCacheKey(userId: string): string {
    return `user:profile:${userId}`;
  }

  private async invalidateProfileCache(userId: string): Promise<void> {
    await this.redisService.del(this.profileCacheKey(userId));
  }

  async findById(id: string): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  /**
   * Search users by username (case-insensitive partial match).
   * Excludes the current user from results. Limited to 20 results.
   */
  async searchByUsername(
    query: string,
    currentUserId: string,
  ): Promise<PublicProfile[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return [];
    }
    // Escape LIKE wildcards to prevent injection of % or _
    const safe = trimmed.replace(/[%_\\]/g, (c) => `\\${c}`);
    const blockedIds = await this.blocksService.getBlockedAndBlockerIds(currentUserId);
    const users = await this.userRepo.find({
      where: {
        username: ILike(`%${safe}%`),
        id: Not(currentUserId),
        isAdmin: false,
      },
      take: 20,
      order: { username: 'ASC' },
    });
    return users
      .filter((u) => !blockedIds.has(u.id))
      .map((u) => ({
      id: u.id,
      username: u.username,
      skillLevel: u.skillLevel,
      position: u.position,
      club: u.club,
      competition: u.competition,
      league: u.league,
      profilePicture: u.profilePicture,
      bio: u.bio,
      createdAt: u.createdAt,
      followersCount: 0,
      followingCount: 0,
    }));
  }

  async getPublicProfile(
    id: string,
    requesterId?: string,
  ): Promise<PublicProfile | PublicProfileWithStatus> {
    // Hide profile if requester and target have blocked each other
    if (requesterId) {
      const blocked = await this.blocksService.isEitherBlocked(requesterId, id);
      if (blocked) throw new NotFoundException('User not found');
    }

    // Cache base profile (without requester-specific fields)
    const cacheKey = this.profileCacheKey(id);
    let base = await this.redisService.getJson<PublicProfile>(cacheKey);

    if (!base) {
      const user = await this.userRepo.findOne({ where: { id } });
      if (!user) throw new NotFoundException('User not found');
      // Admin accounts are hidden from public endpoints
      if (user.isAdmin) throw new NotFoundException('User not found');

      // Count unique connected users (union of followers and following)
      const [followers, following] = await Promise.all([
        this.followRepo.find({ where: { followingId: id }, select: ['followerId'] }),
        this.followRepo.find({ where: { followerId: id }, select: ['followingId'] }),
      ]);
      const uniqueConnections = new Set([
        ...followers.map((f) => f.followerId),
        ...following.map((f) => f.followingId),
      ]);
      const followersCount = uniqueConnections.size;
      const followingCount = 0; // not used separately anymore

      base = {
        id: user.id,
        username: user.username,
        skillLevel: user.skillLevel,
        position: user.position,
        club: user.club ?? null,
        competition: user.competition ?? null,
        league: user.league ?? null,
        profilePicture: user.profilePicture ?? null,
        bio: user.bio ?? null,
        createdAt: user.createdAt,
        followersCount,
        followingCount,
      };
      await this.redisService.setJson(cacheKey, base, 300); // 5 min TTL
    }

    if (!requesterId) return base;

    const isFollowing = !!(await this.followRepo.findOne({
      where: { followerId: requesterId, followingId: id },
    }));

    const [outReq, inReq] = await Promise.all([
      this.followRequestRepo.findOne({
        where: { requesterId, targetId: id },
      }),
      this.followRequestRepo.findOne({
        where: { requesterId: id, targetId: requesterId },
      }),
    ]);
    const outgoingFollowRequestPending = !!outReq;
    const incomingFollowRequestPending = !!inReq;

    return {
      ...base,
      isFollowing,
      outgoingFollowRequestPending,
      incomingFollowRequestPending,
    };
  }

  async follow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    const target = await this.userRepo.findOne({ where: { id: followingId } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.followRepo.findOne({
      where: { followerId, followingId },
    });
    if (existing) return; // idempotent

    await this.followRepo.save({ followerId, followingId });
    await this.invalidateProfileCache(followerId);
    await this.invalidateProfileCache(followingId);
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const [forward, reverse] = await Promise.all([
      this.followRepo.findOne({ where: { followerId, followingId } }),
      this.followRepo.findOne({ where: { followerId: followingId, followingId: followerId } }),
    ]);
    const toRemove = [forward, reverse].filter((f): f is NonNullable<typeof f> => !!f);
    if (toRemove.length > 0) {
      await this.followRepo.remove(toRemove);
      await this.invalidateProfileCache(followerId);
      await this.invalidateProfileCache(followingId);
    }
  }

  async sendFollowRequest(requesterId: string, targetId: string): Promise<void> {
    if (requesterId === targetId) {
      throw new BadRequestException('Cannot request connection to yourself');
    }
    const target = await this.userRepo.findOne({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    const blocked = await this.blocksService.isEitherBlocked(requesterId, targetId);
    if (blocked) throw new NotFoundException('User not found');

    const alreadyFollowing = await this.followRepo.findOne({
      where: { followerId: requesterId, followingId: targetId },
    });
    if (alreadyFollowing) {
      throw new BadRequestException('Already connected');
    }

    const existing = await this.followRequestRepo.findOne({
      where: { requesterId, targetId },
    });
    if (existing) {
      throw new BadRequestException('Request already pending');
    }

    await this.followRequestRepo.save(
      this.followRequestRepo.create({ requesterId, targetId }),
    );
  }

  async cancelFollowRequest(requesterId: string, targetId: string): Promise<void> {
    const row = await this.followRequestRepo.findOne({
      where: { requesterId, targetId },
    });
    if (row) await this.followRequestRepo.remove(row);
  }

  /** Le destinataire (`targetUserId`) accepte la demande de `requesterId`. Crée une relation mutuelle. */
  async acceptFollowRequest(
    targetUserId: string,
    requesterId: string,
  ): Promise<void> {
    const row = await this.followRequestRepo.findOne({
      where: { requesterId, targetId: targetUserId },
    });
    if (!row) {
      throw new NotFoundException('No pending request');
    }
    await this.follow(requesterId, targetUserId);
    await this.follow(targetUserId, requesterId);
    await this.followRequestRepo.remove(row);

    const accepter = await this.userRepo.findOne({ where: { id: targetUserId } });
    this.notificationsService.notifyConnectionAccepted(
      targetUserId,
      accepter?.username ?? 'Someone',
      requesterId,
    ).catch(() => {});
  }

  async declineFollowRequest(
    targetUserId: string,
    requesterId: string,
  ): Promise<void> {
    await this.cancelFollowRequest(requesterId, targetUserId);
  }

  async getIncomingFollowRequests(targetUserId: string): Promise<
    { id: string; createdAt: Date; requester: PublicProfile }[]
  > {
    const rows = await this.followRequestRepo.find({
      where: { targetId: targetUserId },
      order: { createdAt: 'DESC' },
    });
    const result: { id: string; createdAt: Date; requester: PublicProfile }[] =
      [];
    for (const r of rows) {
      const requester = (await this.getPublicProfile(
        r.requesterId,
      )) as PublicProfile;
      result.push({ id: r.id, createdAt: r.createdAt, requester });
    }
    return result;
  }

  async getFollowers(userId: string): Promise<PublicProfile[]> {
    const follows = await this.followRepo.find({
      where: { followingId: userId },
      relations: ['follower'],
    });
    return Promise.all(
      follows.map((f) => this.getPublicProfile(f.followerId) as Promise<PublicProfile>),
    );
  }

  async getFollowing(userId: string): Promise<PublicProfile[]> {
    const follows = await this.followRepo.find({
      where: { followerId: userId },
      relations: ['following'],
    });
    return Promise.all(
      follows.map((f) => this.getPublicProfile(f.followingId) as Promise<PublicProfile>),
    );
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.username !== undefined) {
      this.contentFilter.assertClean(dto.username, 'Username');
      user.username = dto.username;
    }
    if (dto.skillLevel !== undefined) user.skillLevel = dto.skillLevel;
    if (dto.position !== undefined) user.position = dto.position;
    if (dto.club !== undefined) {
      this.contentFilter.assertClean(dto.club, 'Club');
      user.club = dto.club.trim() ? dto.club.trim() : null;
    }
    if (dto.competition !== undefined) {
      this.contentFilter.assertClean(dto.competition, 'Competition');
      user.competition = dto.competition.trim() ? dto.competition.trim() : null;
    }
    if (dto.league !== undefined) {
      user.league = dto.league;
    }
    if (dto.profilePicture !== undefined) {
      const p = dto.profilePicture.trim();
      user.profilePicture = p.length > 0 ? p : null;
    }
    if (dto.bio !== undefined) {
      this.contentFilter.assertClean(dto.bio, 'Bio');
      user.bio = dto.bio.trim() ? dto.bio.trim() : null;
    }
    if (dto.fcmToken !== undefined) user.fcmToken = dto.fcmToken;
    if (dto.locale !== undefined) user.locale = dto.locale;

    if (dto.lat !== undefined && dto.lng !== undefined) {
      await this.userRepo.query(
        `UPDATE users SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
        [dto.lng, dto.lat, userId],
      );
    }

    const saved = await this.userRepo.save(user);
    await this.invalidateProfileCache(userId);
    return this.sanitize(saved);
  }

  /**
   * Delete user account and all associated data.
   * Required by Apple App Store guideline 5.1.1(v).
   *
   * Cascade:
   * - match_participants (user removed from matches)
   * - matches created by user (cancelled — set creator to NULL is not possible due to NOT NULL constraint)
   * - follows (both directions)
   * - follow_requests (both directions)
   * - match_chat_messages (deleted)
   * - match_chat_mutes (deleted)
   * - notifications cache cleared
   * - user row deleted
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.userRepo.manager.transaction(async (mgr) => {
      // Remove user from all match participations
      await mgr.query(
        `DELETE FROM match_participants WHERE user_id = $1`,
        [userId],
      );

      // Delete tournament fixtures of matches created by user
      await mgr.query(
        `DELETE FROM tournament_fixtures WHERE event_match_id IN (SELECT id FROM matches WHERE creator_id = $1)`,
        [userId],
      );

      // Delete chat messages and mutes for matches created by user
      await mgr.query(
        `DELETE FROM match_chat_messages WHERE match_id IN (SELECT id FROM matches WHERE creator_id = $1)`,
        [userId],
      );
      await mgr.query(
        `DELETE FROM match_chat_mutes WHERE match_id IN (SELECT id FROM matches WHERE creator_id = $1)`,
        [userId],
      );

      // Delete remaining participants of matches created by user
      await mgr.query(
        `DELETE FROM match_participants WHERE match_id IN (SELECT id FROM matches WHERE creator_id = $1)`,
        [userId],
      );

      // Delete matches created by user
      await mgr.query(
        `DELETE FROM matches WHERE creator_id = $1`,
        [userId],
      );

      // Delete user's chat messages in other matches
      await mgr.query(
        `DELETE FROM match_chat_messages WHERE user_id = $1`,
        [userId],
      );

      // Delete chat mutes involving user
      await mgr.query(
        `DELETE FROM match_chat_mutes WHERE muted_user_id = $1`,
        [userId],
      );

      // Delete follows in both directions
      await mgr.query(
        `DELETE FROM follows WHERE follower_id = $1 OR following_id = $1`,
        [userId],
      );

      // Delete user blocks in both directions
      await mgr.query(
        `DELETE FROM user_blocks WHERE blocker_id = $1 OR blocked_id = $1`,
        [userId],
      );

      // Delete reports authored by user (target reports survive for moderation)
      await mgr.query(
        `DELETE FROM reports WHERE reporter_id = $1`,
        [userId],
      );

      // Delete follow requests in both directions
      await mgr.query(
        `DELETE FROM follow_requests WHERE requester_id = $1 OR target_id = $1`,
        [userId],
      );

      // Finally, delete the user
      await mgr.query(`DELETE FROM users WHERE id = $1`, [userId]);
    });

    // Clear cache
    await this.invalidateProfileCache(userId);
    await this.redisService.delPattern(`user:${userId}:*`);
    await this.redisService.delPattern(`invites:user:${userId}`);
    await this.redisService.delPattern('nearby:matches:*');
  }

  private sanitize(user: User): Partial<User> {
    const { passwordHash: _ph, fcmToken: _ft, ...rest } = user;
    return rest;
  }
}
