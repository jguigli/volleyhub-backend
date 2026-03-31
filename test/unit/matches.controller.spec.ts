import { MatchesController } from '../../src/modules/matches/matches.controller';

describe('MatchesController (unit)', () => {
  it('delegates read and write calls to services', async () => {
    const matchesService = {
      findNearby: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 'm1' }),
      create: jest.fn().mockResolvedValue({ id: 'm2' }),
      join: jest.fn().mockResolvedValue({ id: 'm1' }),
      leave: jest.fn().mockResolvedValue({ id: 'm1' }),
      updateManage: jest.fn().mockResolvedValue({ id: 'm1' }),
      setMyTeam: jest.fn().mockResolvedValue({ id: 'm1' }),
      deleteMatch: jest.fn().mockResolvedValue(undefined),
    };
    const matchChatService = {
      listMessages: jest.fn().mockResolvedValue({ messages: [], hasMore: false }),
      postMessage: jest.fn().mockResolvedValue({ id: 'msg1' }),
    };
    const controller = new MatchesController(
      matchesService as any,
      matchChatService as any,
    );

    await controller.findNearby({} as any);
    await controller.findById('m1');
    await controller.create({ id: 'u1' } as any, {} as any);
    await controller.join('m1', { id: 'u1' } as any);
    await controller.leave('m1', { id: 'u1' } as any);
    await controller.manage('m1', { id: 'u1' } as any, {} as any);
    await controller.setMyTeam('m1', { id: 'u1' } as any, { teamIndex: 0 } as any);
    await controller.remove('m1', { id: 'u1' } as any);

    expect(matchesService.findNearby).toHaveBeenCalledTimes(1);
    expect(matchesService.findById).toHaveBeenCalledWith('m1');
    expect(matchesService.create).toHaveBeenCalledWith('u1', {});
    expect(matchesService.join).toHaveBeenCalledWith('m1', 'u1');
    expect(matchesService.leave).toHaveBeenCalledWith('m1', 'u1');
    expect(matchesService.updateManage).toHaveBeenCalledWith('m1', 'u1', {});
    expect(matchesService.setMyTeam).toHaveBeenCalledWith('m1', 'u1', 0);
    expect(matchesService.deleteMatch).toHaveBeenCalledWith('m1', 'u1');
  });
});
