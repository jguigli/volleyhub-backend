import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BlocksService } from '../../src/modules/users/blocks.service';

describe('BlocksService (unit)', () => {
  let service: BlocksService;
  let blockRepo: Record<string, jest.Mock>;
  let userRepo: Record<string, jest.Mock>;
  let followRepo: Record<string, jest.Mock>;
  let followRequestRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    blockRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    userRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'target-1', username: 'target' }),
    };
    followRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
    };
    followRequestRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
    };

    service = new BlocksService(
      blockRepo as any,
      userRepo as any,
      followRepo as any,
      followRequestRepo as any,
    );
  });

  describe('block', () => {
    it('should throw BadRequestException when blocker = blocked', async () => {
      await expect(service.block('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when target user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.block('user-1', 'user-2')).rejects.toThrow(NotFoundException);
    });

    it('should create a block and remove existing follows + follow requests in both directions', async () => {
      blockRepo.findOne.mockResolvedValue(null);

      await service.block('user-1', 'user-2');

      expect(blockRepo.save).toHaveBeenCalledWith({ blockerId: 'user-1', blockedId: 'user-2' });
      expect(followRepo.delete).toHaveBeenCalledWith([
        { followerId: 'user-1', followingId: 'user-2' },
        { followerId: 'user-2', followingId: 'user-1' },
      ]);
      expect(followRequestRepo.delete).toHaveBeenCalledWith([
        { requesterId: 'user-1', targetId: 'user-2' },
        { requesterId: 'user-2', targetId: 'user-1' },
      ]);
    });

    it('should be idempotent when block already exists', async () => {
      blockRepo.findOne.mockResolvedValue({ id: 'block-1' });

      await service.block('user-1', 'user-2');

      expect(blockRepo.save).not.toHaveBeenCalled();
      expect(followRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('unblock', () => {
    it('should remove an existing block', async () => {
      const row = { id: 'block-1' };
      blockRepo.findOne.mockResolvedValue(row);

      await service.unblock('user-1', 'user-2');

      expect(blockRepo.remove).toHaveBeenCalledWith(row);
    });

    it('should be a no-op when block does not exist', async () => {
      blockRepo.findOne.mockResolvedValue(null);

      await service.unblock('user-1', 'user-2');

      expect(blockRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('listBlocked', () => {
    it('should return blocked users with profile fields', async () => {
      blockRepo.find.mockResolvedValue([
        {
          createdAt: new Date('2026-01-01'),
          blocked: { id: 'b1', username: 'troll', profilePicture: 'pic.jpg' },
        },
        {
          createdAt: new Date('2026-01-02'),
          blocked: { id: 'b2', username: 'spam', profilePicture: null },
        },
      ]);

      const result = await service.listBlocked('user-1');

      expect(result).toEqual([
        { id: 'b1', username: 'troll', profilePicture: 'pic.jpg', createdAt: new Date('2026-01-01') },
        { id: 'b2', username: 'spam', profilePicture: null, createdAt: new Date('2026-01-02') },
      ]);
    });
  });

  describe('isEitherBlocked', () => {
    it('returns true when either direction has a block', async () => {
      blockRepo.findOne.mockResolvedValue({ id: 'block-1' });
      const result = await service.isEitherBlocked('user-1', 'user-2');
      expect(result).toBe(true);
    });

    it('returns false when no block exists', async () => {
      blockRepo.findOne.mockResolvedValue(null);
      const result = await service.isEitherBlocked('user-1', 'user-2');
      expect(result).toBe(false);
    });
  });

  describe('getBlockedAndBlockerIds', () => {
    it('returns the union of blockers and blocked, excluding the user itself', async () => {
      blockRepo.find.mockResolvedValue([
        { blockerId: 'user-1', blockedId: 'troll' },
        { blockerId: 'spam', blockedId: 'user-1' },
        { blockerId: 'user-1', blockedId: 'rude' },
      ]);

      const result = await service.getBlockedAndBlockerIds('user-1');

      expect(result).toEqual(new Set(['troll', 'spam', 'rude']));
    });

    it('returns an empty set when there are no blocks', async () => {
      blockRepo.find.mockResolvedValue([]);
      const result = await service.getBlockedAndBlockerIds('user-1');
      expect(result.size).toBe(0);
    });
  });
});
