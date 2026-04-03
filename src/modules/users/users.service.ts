import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Follow } from './follow.entity';
import { FollowRequest } from './follow-request.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RedisService } from '../redis/redis.service';

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

  async getPublicProfile(
    id: string,
    requesterId?: string,
  ): Promise<PublicProfile | PublicProfileWithStatus> {
    // Cache base profile (without requester-specific fields)
    const cacheKey = this.profileCacheKey(id);
    let base = await this.redisService.getJson<PublicProfile>(cacheKey);

    if (!base) {
      const user = await this.userRepo.findOne({ where: { id } });
      if (!user) throw new NotFoundException('User not found');

      const [followersCount, followingCount] = await Promise.all([
        this.followRepo.count({ where: { followingId: id } }),
        this.followRepo.count({ where: { followerId: id } }),
      ]);

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

    if (dto.username !== undefined) user.username = dto.username;
    if (dto.skillLevel !== undefined) user.skillLevel = dto.skillLevel;
    if (dto.position !== undefined) user.position = dto.position;
    if (dto.club !== undefined) {
      user.club = dto.club.trim() ? dto.club.trim() : null;
    }
    if (dto.competition !== undefined) {
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
      user.bio = dto.bio.trim() ? dto.bio.trim() : null;
    }
    if (dto.fcmToken !== undefined) user.fcmToken = dto.fcmToken;

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

  private sanitize(user: User): Partial<User> {
    const { passwordHash: _ph, fcmToken: _ft, ...rest } = user;
    return rest;
  }
}
