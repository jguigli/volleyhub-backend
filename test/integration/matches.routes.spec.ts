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
    getUserMatchStats: jest.fn().mockResolvedValue({ played: 0, created: 0, upcoming: 0 }),
    findById: jest.fn().mockResolvedValue({ id: 'm1' }),
    create: jest.fn().mockResolvedValue({ id: 'm2' }),
    join: jest.fn().mockResolvedValue({ id: 'm1' }),
    leave: jest.fn().mockResolvedValue({ id: 'm1' }),
    removeParticipant: jest.fn().mockResolvedValue({ id: 'm1' }),
    updateManage: jest.fn().mockResolvedValue({ id: 'm1' }),
    setMyTeam: jest.fn().mockResolvedValue({ id: 'm1' }),
    renewMatch: jest.fn().mockResolvedValue({ id: 'm1' }),
    deleteMatch: jest.fn().mockResolvedValue(undefined),
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

  it('covers matches routes', async () => {
    await request(app.getHttpServer()).get('/matches').expect(200);
    await request(app.getHttpServer()).get('/matches/suggestions').expect(200);
    await request(app.getHttpServer()).get('/matches/my').expect(200);
    await request(app.getHttpServer()).get('/matches/user/u2/stats').expect(200);
    await request(app.getHttpServer()).get('/matches/m1/chat/messages').expect(200);
    await request(app.getHttpServer()).get('/matches/m1/chat/muted-user-ids').expect(200);
    await request(app.getHttpServer()).get('/matches/m1').expect(200);
    await request(app.getHttpServer()).post('/matches').send({}).expect(201);
    await request(app.getHttpServer()).post('/matches/m1/join').send({}).expect(201);
    await request(app.getHttpServer()).post('/matches/m1/leave').send({}).expect(201);
    await request(app.getHttpServer())
      .post('/matches/m1/remove-participant')
      .send({ userId: 'u2' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/matches/m1/chat/messages')
      .send({ body: 'hello' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/matches/m1/chat/mute')
      .send({ userId: 'u2' })
      .expect(201);
    await request(app.getHttpServer()).delete('/matches/m1/chat/mute/u2').expect(200);
    await request(app.getHttpServer()).patch('/matches/m1/manage').send({}).expect(200);
    await request(app.getHttpServer()).patch('/matches/m1/my-team').send({ teamIndex: 0 }).expect(200);
    await request(app.getHttpServer()).post('/matches/m1/renew').send({}).expect(201);
    await request(app.getHttpServer()).delete('/matches/m1').expect(200);

    expect(matchesService.findNearby).toHaveBeenCalled();
    expect(matchesService.getSuggestions).toHaveBeenCalledWith('u-auth', expect.any(Object));
    expect(matchesService.getMyMatches).toHaveBeenCalledWith('u-auth');
    expect(matchesService.getUserMatchStats).toHaveBeenCalledWith('u2');
    expect(matchesService.findById).toHaveBeenCalledWith('m1');
    expect(matchesService.create).toHaveBeenCalled();
    expect(matchesService.join).toHaveBeenCalledWith('m1', 'u-auth');
    expect(matchesService.leave).toHaveBeenCalledWith('m1', 'u-auth');
    expect(matchesService.removeParticipant).toHaveBeenCalledWith('m1', 'u-auth', 'u2');
    expect(matchChatService.listMessages).toHaveBeenCalledWith('m1', 'u-auth', undefined);
    expect(matchChatService.listMutedUserIds).toHaveBeenCalledWith('m1', 'u-auth');
    expect(matchChatService.postMessage).toHaveBeenCalledWith('m1', 'u-auth', 'hello');
    expect(matchChatService.muteUser).toHaveBeenCalledWith('m1', 'u-auth', 'u2');
    expect(matchChatService.unmuteUser).toHaveBeenCalledWith('m1', 'u-auth', 'u2');
    expect(matchesService.updateManage).toHaveBeenCalled();
    expect(matchesService.setMyTeam).toHaveBeenCalledWith('m1', 'u-auth', 0);
    expect(matchesService.renewMatch).toHaveBeenCalledWith('m1', 'u-auth');
    expect(matchesService.deleteMatch).toHaveBeenCalledWith('m1', 'u-auth');
  });
});
