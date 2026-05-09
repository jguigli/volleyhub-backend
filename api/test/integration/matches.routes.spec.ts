import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MatchesController } from '../../src/modules/matches/matches.controller';
import { MatchesService } from '../../src/modules/matches/matches.service';
import { MatchChatService } from '../../src/modules/matches/match-chat.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';

describe('Matches routes (integration)', () => {
  let app: INestApplication;

  const matchesService = {
    findNearby: jest.fn().mockResolvedValue([]),
    getSuggestions: jest.fn().mockResolvedValue([]),
    getMyMatches: jest.fn().mockResolvedValue([]),
    getUserMatchStatsByFormat: jest.fn().mockResolvedValue({
      played: 0, created: 0, upcoming: 0, wins: 0, losses: 0, winRate: 0, streak: 0,
    }),
    findById: jest.fn().mockResolvedValue({ id: 'm1' }),
    create: jest.fn().mockResolvedValue({ id: 'm2' }),
    join: jest.fn().mockResolvedValue({ id: 'm1' }),
    leave: jest.fn().mockResolvedValue({ id: 'm1' }),
    removeParticipant: jest.fn().mockResolvedValue({ id: 'm1' }),
    invitePlayer: jest.fn().mockResolvedValue({ ok: true }),
    getIncomingInvites: jest.fn().mockResolvedValue([]),
    dismissIncomingInvite: jest.fn().mockResolvedValue(undefined),
    getSentInviteUserIds: jest.fn().mockResolvedValue([]),
    updateManage: jest.fn().mockResolvedValue({ id: 'm1' }),
    setMyTeam: jest.fn().mockResolvedValue({ id: 'm1' }),
    renewMatch: jest.fn().mockResolvedValue({ id: 'm1' }),
    deleteMatch: jest.fn().mockResolvedValue(undefined),
    submitFixtureScore: jest.fn().mockResolvedValue({ id: 'f1' }),
    confirmFixtureScore: jest.fn().mockResolvedValue({ id: 'f1' }),
    organizerOverrideFixtureScore: jest.fn().mockResolvedValue({ id: 'f1' }),
    getMatchLockPreview: jest.fn().mockResolvedValue({
      canLock: true,
      needsAssignment: false,
      warnings: { teamAEmpty: false, teamBEmpty: false, unassignedCount: 0, unassignedUserIds: [] },
    }),
  };

  const matchChatService = {
    listMessages: jest.fn().mockResolvedValue({ messages: [], hasMore: false }),
    listMutedUserIds: jest.fn().mockResolvedValue([]),
    postMessage: jest.fn().mockResolvedValue({ id: 'msg1' }),
    muteUser: jest.fn().mockResolvedValue({ ok: true }),
    unmuteUser: jest.fn().mockResolvedValue({ ok: true }),
  };

  const authGuard: CanActivate = {
    canActivate: (ctx: ExecutionContext) => {
      const req = ctx.switchToHttp().getRequest();
      req.user = { id: 'u-auth' };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        { provide: MatchesService, useValue: matchesService },
        { provide: MatchChatService, useValue: matchChatService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET routes ───────────────────────────────────────────────────────

  it('GET /matches -> 200, calls findNearby', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches')
      .expect(200);

    expect(matchesService.findNearby).toHaveBeenCalledWith(expect.any(Object));
    expect(res.body).toEqual([]);
  });

  it('GET /matches/suggestions -> 200 (auth), calls getSuggestions', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches/suggestions')
      .expect(200);

    expect(matchesService.getSuggestions).toHaveBeenCalledWith('u-auth', expect.any(Object));
    expect(res.body).toEqual([]);
  });

  it('GET /matches/my -> 200 (auth), calls getMyMatches', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches/my')
      .expect(200);

    expect(matchesService.getMyMatches).toHaveBeenCalledWith('u-auth');
    expect(res.body).toEqual([]);
  });

  it('GET /matches/user/:userId/stats -> 200, calls getUserMatchStatsByFormat', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches/user/u2/stats')
      .expect(200);

    expect(matchesService.getUserMatchStatsByFormat).toHaveBeenCalledWith('u2', undefined);
    expect(res.body).toHaveProperty('played', 0);
  });

  it('GET /matches/user/:userId/stats?eventFormat=tournament -> 200, passes format', async () => {
    await request(app.getHttpServer())
      .get('/matches/user/u2/stats?eventFormat=tournament')
      .expect(200);

    expect(matchesService.getUserMatchStatsByFormat).toHaveBeenCalledWith('u2', 'tournament');
  });

  it('GET /matches/user/:userId/stats?eventFormat=invalid -> passes undefined for invalid format', async () => {
    await request(app.getHttpServer())
      .get('/matches/user/u2/stats?eventFormat=invalid')
      .expect(200);

    expect(matchesService.getUserMatchStatsByFormat).toHaveBeenCalledWith('u2', undefined);
  });

  it('GET /matches/:id/lock-preview -> 200 (auth), calls getMatchLockPreview', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches/m1/lock-preview')
      .expect(200);

    expect(matchesService.getMatchLockPreview).toHaveBeenCalledWith('m1', 'u-auth');
    expect(res.body).toEqual({
      canLock: true,
      needsAssignment: false,
      warnings: {
        teamAEmpty: false,
        teamBEmpty: false,
        unassignedCount: 0,
        unassignedUserIds: [],
      },
    });
  });

  it('GET /matches/:id/lock-preview -> 500 when service throws', async () => {
    matchesService.getMatchLockPreview.mockRejectedValueOnce(new Error('boom'));
    await request(app.getHttpServer())
      .get('/matches/m1/lock-preview')
      .expect(500);
  });

  it('GET /matches/:id -> 200, calls findById', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches/m1')
      .expect(200);

    expect(matchesService.findById).toHaveBeenCalledWith('m1');
    expect(res.body).toEqual({ id: 'm1' });
  });

  it('GET /matches/:id/chat/messages -> 200 (auth), calls listMessages', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches/m1/chat/messages')
      .expect(200);

    expect(matchChatService.listMessages).toHaveBeenCalledWith('m1', 'u-auth', undefined);
    expect(res.body).toEqual({ messages: [], hasMore: false });
  });

  it('GET /matches/:id/chat/messages?before=uuid -> 200, passes before param', async () => {
    await request(app.getHttpServer())
      .get('/matches/m1/chat/messages?before=some-uuid')
      .expect(200);

    expect(matchChatService.listMessages).toHaveBeenCalledWith('m1', 'u-auth', 'some-uuid');
  });

  it('GET /matches/:id/chat/muted-user-ids -> 200 (auth), calls listMutedUserIds', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches/m1/chat/muted-user-ids')
      .expect(200);

    expect(matchChatService.listMutedUserIds).toHaveBeenCalledWith('m1', 'u-auth');
    expect(res.body).toEqual([]);
  });

  it('GET /matches/incoming-invites -> 200 (auth), calls getIncomingInvites', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches/incoming-invites')
      .expect(200);

    expect(matchesService.getIncomingInvites).toHaveBeenCalledWith('u-auth');
    expect(res.body).toEqual([]);
  });

  it('GET /matches/:id/sent-invites -> 200 (auth), calls getSentInviteUserIds', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches/m1/sent-invites')
      .expect(200);

    expect(matchesService.getSentInviteUserIds).toHaveBeenCalledWith('m1', 'u-auth');
    expect(res.body).toEqual([]);
  });

  // ─── POST routes ──────────────────────────────────────────────────────

  it('POST /matches -> 201 (auth), sends match creation dto', async () => {
    const dto = {
      eventFormat: 'match',
      courtId: 'c1',
      date: '2026-05-01T10:00:00Z',
      maxPlayers: 6,
    };
    const res = await request(app.getHttpServer())
      .post('/matches')
      .send(dto)
      .expect(201);

    expect(matchesService.create).toHaveBeenCalledWith('u-auth', expect.objectContaining({
      eventFormat: 'match',
      courtId: 'c1',
    }));
    expect(res.body).toEqual({ id: 'm2' });
  });

  it('POST /matches -> 201 (auth), sends tournament creation dto', async () => {
    const dto = {
      eventFormat: 'tournament',
      courtId: 'c1',
      date: '2026-06-01T09:00:00Z',
      maxPlayers: 16,
      tournamentFormat: 'single_elimination',
    };
    await request(app.getHttpServer())
      .post('/matches')
      .send(dto)
      .expect(201);

    expect(matchesService.create).toHaveBeenCalledWith('u-auth', expect.objectContaining({
      eventFormat: 'tournament',
      tournamentFormat: 'single_elimination',
    }));
  });

  it('POST /matches/:id/join -> 201 (auth), calls join', async () => {
    await request(app.getHttpServer())
      .post('/matches/m1/join')
      .send({})
      .expect(201);

    expect(matchesService.join).toHaveBeenCalledWith('m1', 'u-auth');
  });

  it('POST /matches/:id/leave -> 201 (auth), calls leave', async () => {
    await request(app.getHttpServer())
      .post('/matches/m1/leave')
      .send({})
      .expect(201);

    expect(matchesService.leave).toHaveBeenCalledWith('m1', 'u-auth');
  });

  it('POST /matches/:id/remove-participant -> 201 (auth), body { userId }', async () => {
    await request(app.getHttpServer())
      .post('/matches/m1/remove-participant')
      .send({ userId: 'u2' })
      .expect(201);

    expect(matchesService.removeParticipant).toHaveBeenCalledWith('m1', 'u-auth', 'u2');
  });

  it('POST /matches/:id/invite -> 201 (auth), body { userId }', async () => {
    await request(app.getHttpServer())
      .post('/matches/m1/invite')
      .send({ userId: 'u3' })
      .expect(201);

    expect(matchesService.invitePlayer).toHaveBeenCalledWith('m1', 'u-auth', 'u3');
  });

  it('POST /matches/:id/chat/messages -> 201 (auth), body { body: "hello" }', async () => {
    await request(app.getHttpServer())
      .post('/matches/m1/chat/messages')
      .send({ body: 'hello' })
      .expect(201);

    expect(matchChatService.postMessage).toHaveBeenCalledWith('m1', 'u-auth', 'hello');
  });

  it('POST /matches/:id/chat/mute -> 201 (auth), body { userId }', async () => {
    await request(app.getHttpServer())
      .post('/matches/m1/chat/mute')
      .send({ userId: 'u2' })
      .expect(201);

    expect(matchChatService.muteUser).toHaveBeenCalledWith('m1', 'u-auth', 'u2');
  });

  it('POST /matches/:id/renew -> 201 (auth), calls renewMatch', async () => {
    await request(app.getHttpServer())
      .post('/matches/m1/renew')
      .send({})
      .expect(201);

    expect(matchesService.renewMatch).toHaveBeenCalledWith('m1', 'u-auth');
  });

  // ─── PATCH routes ─────────────────────────────────────────────────────

  it('PATCH /matches/:id/manage -> 200 (auth), body with teamAssignments', async () => {
    const dto = { teamAssignments: { 'u-auth': 0, 'u2': 1 } };
    await request(app.getHttpServer())
      .patch('/matches/m1/manage')
      .send(dto)
      .expect(200);

    expect(matchesService.updateManage).toHaveBeenCalledWith(
      'm1',
      'u-auth',
      expect.objectContaining({ teamAssignments: { 'u-auth': 0, 'u2': 1 } }),
    );
  });

  it('PATCH /matches/:id/my-team -> 200 (auth), body { teamIndex: 0 }', async () => {
    await request(app.getHttpServer())
      .patch('/matches/m1/my-team')
      .send({ teamIndex: 0 })
      .expect(200);

    expect(matchesService.setMyTeam).toHaveBeenCalledWith('m1', 'u-auth', 0, undefined);
  });

  it('PATCH /matches/:id/my-team -> 200 (auth), body { teamIndex: null } (unassign)', async () => {
    await request(app.getHttpServer())
      .patch('/matches/m1/my-team')
      .send({ teamIndex: null })
      .expect(200);

    expect(matchesService.setMyTeam).toHaveBeenCalledWith('m1', 'u-auth', null, undefined);
  });

  // ─── DELETE routes ────────────────────────────────────────────────────

  it('DELETE /matches/:id -> 200 (auth), calls deleteMatch', async () => {
    await request(app.getHttpServer())
      .delete('/matches/m1')
      .expect(200);

    expect(matchesService.deleteMatch).toHaveBeenCalledWith('m1', 'u-auth');
  });

  it('DELETE /matches/:id/chat/mute/:userId -> 200 (auth), calls unmuteUser', async () => {
    await request(app.getHttpServer())
      .delete('/matches/m1/chat/mute/u2')
      .expect(200);

    expect(matchChatService.unmuteUser).toHaveBeenCalledWith('m1', 'u-auth', 'u2');
  });

  it('DELETE /matches/incoming-invites/:inviteId -> 200 (auth), calls dismissIncomingInvite', async () => {
    await request(app.getHttpServer())
      .delete('/matches/incoming-invites/inv1')
      .expect(200);

    expect(matchesService.dismissIncomingInvite).toHaveBeenCalledWith('u-auth', 'inv1');
  });

  // ─── Tournament fixture routes ────────────────────────────────────────

  it('POST /matches/fixtures/:fixtureId/score -> 201 (auth), body { score: 21 }', async () => {
    const res = await request(app.getHttpServer())
      .post('/matches/fixtures/f1/score')
      .send({ score: 21 })
      .expect(201);

    expect(matchesService.submitFixtureScore).toHaveBeenCalledWith('f1', 'u-auth', 21);
    expect(res.body).toEqual({ id: 'f1' });
  });

  it('POST /matches/fixtures/:fixtureId/confirm -> 201 (auth), calls confirmFixtureScore', async () => {
    const res = await request(app.getHttpServer())
      .post('/matches/fixtures/f1/confirm')
      .send({})
      .expect(201);

    expect(matchesService.confirmFixtureScore).toHaveBeenCalledWith('f1', 'u-auth', undefined);
    expect(res.body).toEqual({ id: 'f1' });
  });

  it('PATCH /matches/fixtures/:fixtureId/override -> 200 (auth), body { scoreA: 21, scoreB: 15 }', async () => {
    const res = await request(app.getHttpServer())
      .patch('/matches/fixtures/f1/override')
      .send({ scoreA: 21, scoreB: 15 })
      .expect(200);

    expect(matchesService.organizerOverrideFixtureScore).toHaveBeenCalledWith('f1', 'u-auth', 21, 15);
    expect(res.body).toEqual({ id: 'f1' });
  });
});
