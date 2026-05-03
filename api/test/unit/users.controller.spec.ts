import { UsersController } from '../../src/modules/users/users.controller';

describe('UsersController (unit)', () => {
  let controller: UsersController;
  let usersService: Record<string, jest.Mock>;
  let blocksService: Record<string, jest.Mock>;

  const fakeUser = { id: 'user-1', username: 'player1' };

  beforeEach(() => {
    usersService = {
      getPublicProfile: jest.fn().mockResolvedValue({ id: 'target-1', username: 'target' }),
      getFollowers: jest.fn().mockResolvedValue([]),
      getFollowing: jest.fn().mockResolvedValue([]),
      updateProfile: jest.fn().mockResolvedValue({ id: 'user-1', bio: 'updated' }),
      follow: jest.fn().mockResolvedValue(undefined),
      unfollow: jest.fn().mockResolvedValue(undefined),
      sendFollowRequest: jest.fn().mockResolvedValue(undefined),
      cancelFollowRequest: jest.fn().mockResolvedValue(undefined),
      acceptFollowRequest: jest.fn().mockResolvedValue(undefined),
      declineFollowRequest: jest.fn().mockResolvedValue(undefined),
      getIncomingFollowRequests: jest.fn().mockResolvedValue([]),
      deleteAccount: jest.fn().mockResolvedValue(undefined),
    };
    blocksService = {
      block: jest.fn().mockResolvedValue(undefined),
      unblock: jest.fn().mockResolvedValue(undefined),
      listBlocked: jest.fn().mockResolvedValue([{ id: 'blocked-1', username: 'blocked' }]),
    };

    controller = new UsersController(usersService as any, blocksService as any);
  });

  describe('getPublicProfile', () => {
    it('should pass target id and requesterId from authenticated user', async () => {
      const req = { user: fakeUser };

      await controller.getPublicProfile('target-1', req as any);

      expect(usersService.getPublicProfile).toHaveBeenCalledWith('target-1', 'user-1');
    });

    it('should pass undefined requesterId when no authenticated user', async () => {
      const req = { user: undefined };

      await controller.getPublicProfile('target-1', req as any);

      expect(usersService.getPublicProfile).toHaveBeenCalledWith('target-1', undefined);
    });

    it('should pass undefined requesterId when req.user is missing entirely', async () => {
      const req = {};

      await controller.getPublicProfile('target-1', req as any);

      expect(usersService.getPublicProfile).toHaveBeenCalledWith('target-1', undefined);
    });
  });

  describe('getFollowers', () => {
    it('should delegate to usersService.getFollowers with user id', async () => {
      await controller.getFollowers('user-42');

      expect(usersService.getFollowers).toHaveBeenCalledWith('user-42');
    });
  });

  describe('getFollowing', () => {
    it('should delegate to usersService.getFollowing with user id', async () => {
      await controller.getFollowing('user-42');

      expect(usersService.getFollowing).toHaveBeenCalledWith('user-42');
    });
  });

  describe('updateMe', () => {
    it('should delegate to usersService.updateProfile with user.id from @CurrentUser and dto', async () => {
      const dto = { bio: 'new bio', club: 'VC Paris' };

      await controller.updateMe(fakeUser as any, dto as any);

      expect(usersService.updateProfile).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('follow', () => {
    it('should call usersService.follow with current user id and target id', async () => {
      await controller.follow('target-5', fakeUser as any);

      expect(usersService.follow).toHaveBeenCalledWith('user-1', 'target-5');
    });
  });

  describe('unfollow', () => {
    it('should call usersService.unfollow with current user id and target id', async () => {
      await controller.unfollow('target-5', fakeUser as any);

      expect(usersService.unfollow).toHaveBeenCalledWith('user-1', 'target-5');
    });
  });

  describe('sendFollowRequest', () => {
    it('should call usersService.sendFollowRequest with current user id and target id', async () => {
      await controller.sendFollowRequest('target-7', fakeUser as any);

      expect(usersService.sendFollowRequest).toHaveBeenCalledWith('user-1', 'target-7');
    });
  });

  describe('cancelFollowRequest', () => {
    it('should call usersService.cancelFollowRequest with current user id and target id', async () => {
      await controller.cancelFollowRequest('target-7', fakeUser as any);

      expect(usersService.cancelFollowRequest).toHaveBeenCalledWith('user-1', 'target-7');
    });
  });

  describe('acceptFollowRequest', () => {
    it('should call usersService.acceptFollowRequest with current user id and requester id', async () => {
      await controller.acceptFollowRequest('requester-9', fakeUser as any);

      expect(usersService.acceptFollowRequest).toHaveBeenCalledWith('user-1', 'requester-9');
    });
  });

  describe('declineFollowRequest', () => {
    it('should call usersService.declineFollowRequest with current user id and requester id', async () => {
      await controller.declineFollowRequest('requester-9', fakeUser as any);

      expect(usersService.declineFollowRequest).toHaveBeenCalledWith('user-1', 'requester-9');
    });
  });

  describe('getIncomingFollowRequests', () => {
    it('should call usersService.getIncomingFollowRequests with current user id', async () => {
      await controller.getIncomingFollowRequests(fakeUser as any);

      expect(usersService.getIncomingFollowRequests).toHaveBeenCalledWith('user-1');
    });
  });

  describe('listBlocks', () => {
    it('should call blocksService.listBlocked with current user id', async () => {
      const result = await controller.listBlocks(fakeUser as any);
      expect(blocksService.listBlocked).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ id: 'blocked-1', username: 'blocked' }]);
    });
  });

  describe('blockUser', () => {
    it('should call blocksService.block with current user id and target id', async () => {
      const result = await controller.blockUser('target-9', fakeUser as any);
      expect(blocksService.block).toHaveBeenCalledWith('user-1', 'target-9');
      expect(result).toEqual({ success: true });
    });

    it('should propagate errors from blocksService.block', async () => {
      blocksService.block.mockRejectedValue(new Error('Cannot block yourself'));
      await expect(controller.blockUser('target-9', fakeUser as any)).rejects.toThrow(
        'Cannot block yourself',
      );
    });
  });

  describe('unblockUser', () => {
    it('should call blocksService.unblock with current user id and target id', async () => {
      const result = await controller.unblockUser('target-9', fakeUser as any);
      expect(blocksService.unblock).toHaveBeenCalledWith('user-1', 'target-9');
      expect(result).toEqual({ success: true });
    });
  });

  describe('deleteMe', () => {
    it('should call usersService.deleteAccount with current user id', async () => {
      await controller.deleteMe(fakeUser as any);

      expect(usersService.deleteAccount).toHaveBeenCalledWith('user-1');
    });

    it('should return success true', async () => {
      const result = await controller.deleteMe(fakeUser as any);

      expect(result).toEqual({ success: true });
    });

    it('should propagate errors from usersService.deleteAccount', async () => {
      usersService.deleteAccount.mockRejectedValue(new Error('User not found'));

      await expect(controller.deleteMe(fakeUser as any)).rejects.toThrow('User not found');
    });
  });
});
