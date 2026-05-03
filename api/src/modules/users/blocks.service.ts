import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserBlock } from './user-block.entity';
import { Follow } from './follow.entity';
import { FollowRequest } from './follow-request.entity';

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(UserBlock)
    private readonly blockRepo: Repository<UserBlock>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(FollowRequest)
    private readonly followRequestRepo: Repository<FollowRequest>,
  ) {}

  /**
   * Block a user. Removes any existing follow relationships and pending requests
   * between blocker and blocked, in both directions.
   */
  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const target = await this.userRepo.findOne({ where: { id: blockedId } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.blockRepo.findOne({
      where: { blockerId, blockedId },
    });
    if (existing) return; // idempotent

    await this.blockRepo.save({ blockerId, blockedId });

    // Remove existing follows in both directions
    await this.followRepo.delete([
      { followerId: blockerId, followingId: blockedId },
      { followerId: blockedId, followingId: blockerId },
    ]);

    // Remove pending follow requests in both directions
    await this.followRequestRepo.delete([
      { requesterId: blockerId, targetId: blockedId },
      { requesterId: blockedId, targetId: blockerId },
    ]);
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    const row = await this.blockRepo.findOne({
      where: { blockerId, blockedId },
    });
    if (row) {
      await this.blockRepo.remove(row);
    }
  }

  /** List of users blocked by `userId`. */
  async listBlocked(userId: string): Promise<
    { id: string; username: string; profilePicture: string | null; createdAt: Date }[]
  > {
    const rows = await this.blockRepo.find({
      where: { blockerId: userId },
      relations: ['blocked'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.blocked.id,
      username: r.blocked.username,
      profilePicture: r.blocked.profilePicture ?? null,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Returns true if either user has blocked the other (bidirectional check).
   * Used by callers to filter visibility (search, profile, chat...).
   */
  async isEitherBlocked(userA: string, userB: string): Promise<boolean> {
    const found = await this.blockRepo.findOne({
      where: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    });
    return !!found;
  }

  /** Returns the set of user IDs that should be filtered out when `userId` is the requester. */
  async getBlockedAndBlockerIds(userId: string): Promise<Set<string>> {
    const rows = await this.blockRepo.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });
    const ids = new Set<string>();
    for (const r of rows) {
      if (r.blockerId !== userId) ids.add(r.blockerId);
      if (r.blockedId !== userId) ids.add(r.blockedId);
    }
    return ids;
  }
}
