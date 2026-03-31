import { UsersController } from '../../src/modules/users/users.controller';

describe('UsersController (unit)', () => {
  it('delegates core profile/follow endpoints to UsersService', async () => {
    const usersService = {
      getPublicProfile: jest.fn().mockResolvedValue({ id: 'u2' }),
      getFollowers: jest.fn().mockResolvedValue([]),
      getFollowing: jest.fn().mockResolvedValue([]),
      updateProfile: jest.fn().mockResolvedValue({ id: 'u1' }),
      follow: jest.fn().mockResolvedValue({ ok: true }),
      unfollow: jest.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new UsersController(usersService as any);

    await controller.getPublicProfile('u2', { user: { id: 'u1' } } as any);
    await controller.getFollowers('u2');
    await controller.getFollowing('u2');
    await controller.updateMe({ id: 'u1' } as any, { bio: 'x' } as any);
    await controller.follow('u2', { id: 'u1' } as any);
    await controller.unfollow('u2', { id: 'u1' } as any);

    expect(usersService.getPublicProfile).toHaveBeenCalledWith('u2', 'u1');
    expect(usersService.getFollowers).toHaveBeenCalledWith('u2');
    expect(usersService.getFollowing).toHaveBeenCalledWith('u2');
    expect(usersService.updateProfile).toHaveBeenCalledWith('u1', { bio: 'x' });
    expect(usersService.follow).toHaveBeenCalledWith('u1', 'u2');
    expect(usersService.unfollow).toHaveBeenCalledWith('u1', 'u2');
  });
});
