import { MatchesController } from '../../src/modules/matches/matches.controller';

describe('MatchesController (unit)', () => {
  let controller: MatchesController;
  let matchesService: Record<string, jest.Mock>;
  let matchChatService: Record<string, jest.Mock>;

  const fakeUser = { id: 'user-1', username: 'player1' };

  beforeEach(() => {
    matchesService = {
      findNearby: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn().mockResolvedValue([]),
      getMyMatches: jest.fn().mockResolvedValue([]),
      getIncomingInvites: jest.fn().mockResolvedValue([]),
      dismissIncomingInvite: jest.fn().mockResolvedValue(undefined),
      getUserMatchStatsByFormat: jest.fn().mockResolvedValue({ played: 5, won: 3 }),
      findById: jest.fn().mockResolvedValue({ id: 'm1' }),
      create: jest.fn().mockResolvedValue({ id: 'm-new' }),
      join: jest.fn().mockResolvedValue({ id: 'm1' }),
      leave: jest.fn().mockResolvedValue({ id: 'm1' }),
      removeParticipant: jest.fn().mockResolvedValue(undefined),
      invitePlayer: jest.fn().mockResolvedValue(undefined),
      getSentInviteUserIds: jest.fn().mockResolvedValue(['uid-1', 'uid-2']),
      updateManage: jest.fn().mockResolvedValue({ id: 'm1' }),
      setMyTeam: jest.fn().mockResolvedValue({ id: 'm1' }),
      renewMatch: jest.fn().mockResolvedValue({ id: 'm-renewed' }),
      deleteMatch: jest.fn().mockResolvedValue(undefined),
      submitFixtureScore: jest.fn().mockResolvedValue(undefined),
      confirmFixtureScore: jest.fn().mockResolvedValue(undefined),
      organizerOverrideFixtureScore: jest.fn().mockResolvedValue(undefined),
    };

    matchChatService = {
      listMessages: jest.fn().mockResolvedValue({ messages: [], hasMore: false }),
      listMutedUserIds: jest.fn().mockResolvedValue([]),
      postMessage: jest.fn().mockResolvedValue({ id: 'msg1' }),
      muteUser: jest.fn().mockResolvedValue(undefined),
      unmuteUser: jest.fn().mockResolvedValue(undefined),
    };

    controller = new MatchesController(
      matchesService as any,
      matchChatService as any,
    );
  });

  // ─── GET endpoints ───────────────────────────────────────────────

  describe('findNearby', () => {
    it('should delegate to matchesService.findNearby with query', async () => {
      const query = { lat: 48.85, lng: 2.35, radius: 10 };

      await controller.findNearby(query as any);

      expect(matchesService.findNearby).toHaveBeenCalledWith(query);
    });
  });

  describe('getSuggestions', () => {
    it('should pass user id and query to matchesService.getSuggestions', async () => {
      const query = { lat: 48.85, lng: 2.35 };

      await controller.getSuggestions(fakeUser as any, query as any);

      expect(matchesService.getSuggestions).toHaveBeenCalledWith('user-1', query);
    });
  });

  describe('getMyMatches', () => {
    it('should pass user id to matchesService.getMyMatches', async () => {
      await controller.getMyMatches(fakeUser as any);

      expect(matchesService.getMyMatches).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getIncomingInvites', () => {
    it('should pass user id to matchesService.getIncomingInvites', async () => {
      await controller.getIncomingInvites(fakeUser as any);

      expect(matchesService.getIncomingInvites).toHaveBeenCalledWith('user-1');
    });
  });

  describe('dismissIncomingInvite', () => {
    it('should pass user id and inviteId', async () => {
      await controller.dismissIncomingInvite(fakeUser as any, 'invite-42');

      expect(matchesService.dismissIncomingInvite).toHaveBeenCalledWith('user-1', 'invite-42');
    });
  });

  describe('getUserMatchStats', () => {
    it('should pass userId and parsed eventFormat "match"', async () => {
      await controller.getUserMatchStats('target-user', 'match');

      expect(matchesService.getUserMatchStatsByFormat).toHaveBeenCalledWith('target-user', 'match');
    });

    it('should pass userId and parsed eventFormat "tournament"', async () => {
      await controller.getUserMatchStats('target-user', 'tournament');

      expect(matchesService.getUserMatchStatsByFormat).toHaveBeenCalledWith('target-user', 'tournament');
    });

    it('should pass undefined for unrecognized eventFormat', async () => {
      await controller.getUserMatchStats('target-user', 'invalid_format');

      expect(matchesService.getUserMatchStatsByFormat).toHaveBeenCalledWith('target-user', undefined);
    });

    it('should pass undefined when no eventFormat query param', async () => {
      await controller.getUserMatchStats('target-user', undefined);

      expect(matchesService.getUserMatchStatsByFormat).toHaveBeenCalledWith('target-user', undefined);
    });
  });

  describe('findById', () => {
    it('should delegate to matchesService.findById with match id', async () => {
      await controller.findById('m-123');

      expect(matchesService.findById).toHaveBeenCalledWith('m-123');
    });
  });

  // ─── POST endpoints ──────────────────────────────────────────────

  describe('create', () => {
    it('should pass user id and dto to matchesService.create', async () => {
      const dto = { title: 'Beach Match', maxPlayers: 4 };

      await controller.create(fakeUser as any, dto as any);

      expect(matchesService.create).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('join', () => {
    it('should pass match id and user id', async () => {
      await controller.join('m-1', fakeUser as any);

      expect(matchesService.join).toHaveBeenCalledWith('m-1', 'user-1');
    });
  });

  describe('leave', () => {
    it('should pass match id and user id', async () => {
      await controller.leave('m-1', fakeUser as any);

      expect(matchesService.leave).toHaveBeenCalledWith('m-1', 'user-1');
    });
  });

  describe('removeParticipant', () => {
    it('should pass match id, organizer user id, and target userId from dto', async () => {
      const dto = { userId: 'kicked-user' };

      await controller.removeParticipant('m-1', fakeUser as any, dto as any);

      expect(matchesService.removeParticipant).toHaveBeenCalledWith('m-1', 'user-1', 'kicked-user');
    });
  });

  describe('invitePlayer', () => {
    it('should pass match id, inviter user id, and invitee userId from dto', async () => {
      const dto = { userId: 'invited-user' };

      await controller.invitePlayer('m-1', fakeUser as any, dto as any);

      expect(matchesService.invitePlayer).toHaveBeenCalledWith('m-1', 'user-1', 'invited-user');
    });
  });

  describe('getSentInvites', () => {
    it('should pass match id and user id to getSentInviteUserIds', async () => {
      const result = await controller.getSentInvites('m-1', fakeUser as any);

      expect(matchesService.getSentInviteUserIds).toHaveBeenCalledWith('m-1', 'user-1');
      expect(result).toEqual(['uid-1', 'uid-2']);
    });
  });

  describe('renew', () => {
    it('should pass match id and user id', async () => {
      await controller.renew('m-1', fakeUser as any);

      expect(matchesService.renewMatch).toHaveBeenCalledWith('m-1', 'user-1');
    });
  });

  // ─── Tournament fixture endpoints ────────────────────────────────

  describe('submitFixtureScore', () => {
    it('should pass fixtureId, user id, and score from dto', async () => {
      const dto = { score: 15 };

      await controller.submitFixtureScore('fix-1', fakeUser as any, dto as any);

      expect(matchesService.submitFixtureScore).toHaveBeenCalledWith('fix-1', 'user-1', 15);
    });
  });

  describe('confirmFixtureScore', () => {
    it('should pass fixtureId and user id', async () => {
      await controller.confirmFixtureScore('fix-1', fakeUser as any);

      expect(matchesService.confirmFixtureScore).toHaveBeenCalledWith('fix-1', 'user-1');
    });
  });

  describe('overrideFixtureScore', () => {
    it('should pass fixtureId, user id, scoreA and scoreB from dto', async () => {
      const dto = { scoreA: 25, scoreB: 18 };

      await controller.overrideFixtureScore('fix-1', fakeUser as any, dto as any);

      expect(matchesService.organizerOverrideFixtureScore).toHaveBeenCalledWith(
        'fix-1',
        'user-1',
        25,
        18,
      );
    });
  });

  // ─── PATCH endpoints ─────────────────────────────────────────────

  describe('manage', () => {
    it('should pass match id, user id, and dto', async () => {
      const dto = { title: 'Updated title' };

      await controller.manage('m-1', fakeUser as any, dto as any);

      expect(matchesService.updateManage).toHaveBeenCalledWith('m-1', 'user-1', dto);
    });
  });

  describe('setMyTeam', () => {
    it('should pass match id, user id, and teamIndex from dto', async () => {
      const dto = { teamIndex: 1 };

      await controller.setMyTeam('m-1', fakeUser as any, dto as any);

      expect(matchesService.setMyTeam).toHaveBeenCalledWith('m-1', 'user-1', 1, undefined);
    });
  });

  // ─── DELETE endpoints ────────────────────────────────────────────

  describe('remove', () => {
    it('should pass match id and user id', async () => {
      await controller.remove('m-1', fakeUser as any);

      expect(matchesService.deleteMatch).toHaveBeenCalledWith('m-1', 'user-1');
    });
  });

  // ─── Chat endpoints ──────────────────────────────────────────────

  describe('getChatMessages', () => {
    it('should pass matchId, userId, and optional before cursor', async () => {
      await controller.getChatMessages('m-1', fakeUser as any, 'cursor-abc');

      expect(matchChatService.listMessages).toHaveBeenCalledWith('m-1', 'user-1', 'cursor-abc');
    });

    it('should pass undefined for before when not provided', async () => {
      await controller.getChatMessages('m-1', fakeUser as any, undefined);

      expect(matchChatService.listMessages).toHaveBeenCalledWith('m-1', 'user-1', undefined);
    });
  });

  describe('getChatMutedUserIds', () => {
    it('should pass matchId and userId', async () => {
      await controller.getChatMutedUserIds('m-1', fakeUser as any);

      expect(matchChatService.listMutedUserIds).toHaveBeenCalledWith('m-1', 'user-1');
    });
  });

  describe('postChatMessage', () => {
    it('should pass matchId, userId, and body from dto', async () => {
      const dto = { body: 'Hello team!' };

      await controller.postChatMessage('m-1', fakeUser as any, dto as any);

      expect(matchChatService.postMessage).toHaveBeenCalledWith('m-1', 'user-1', 'Hello team!');
    });
  });

  describe('muteChatUser', () => {
    it('should pass matchId, userId, and target userId from dto', async () => {
      const dto = { userId: 'muted-user' };

      await controller.muteChatUser('m-1', fakeUser as any, dto as any);

      expect(matchChatService.muteUser).toHaveBeenCalledWith('m-1', 'user-1', 'muted-user');
    });
  });

  describe('unmuteChatUser', () => {
    it('should pass matchId, userId, and target userId param', async () => {
      await controller.unmuteChatUser('m-1', fakeUser as any, 'muted-user');

      expect(matchChatService.unmuteUser).toHaveBeenCalledWith('m-1', 'user-1', 'muted-user');
    });
  });
});
