import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UsersController } from '../../src/modules/users/users.controller';
import { UsersService } from '../../src/modules/users/users.service';
import { BlocksService } from '../../src/modules/users/blocks.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../src/common/guards/optional-jwt-auth.guard';

describe('Users routes (integration)', () => {
  let app: INestApplication;
  const usersService = {
    getIncomingFollowRequests: jest.fn().mockResolvedValue([{ id: 'fr1', fromUserId: 'u3' }]),
    sendFollowRequest: jest.fn().mockResolvedValue({ ok: true }),
    cancelFollowRequest: jest.fn().mockResolvedValue({ ok: true }),
    acceptFollowRequest: jest.fn().mockResolvedValue({ ok: true }),
    declineFollowRequest: jest.fn().mockResolvedValue({ ok: true }),
    getPublicProfile: jest.fn().mockResolvedValue({ id: 'u2', username: 'bob' }),
    getFollowers: jest.fn().mockResolvedValue([{ id: 'u3' }]),
    getFollowing: jest.fn().mockResolvedValue([{ id: 'u4' }]),
    follow: jest.fn().mockResolvedValue({ ok: true }),
    unfollow: jest.fn().mockResolvedValue({ ok: true }),
    updateProfile: jest.fn().mockResolvedValue({ id: 'u-auth', bio: 'Updated' }),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
  };
  const blocksService = {
    listBlocked: jest.fn().mockResolvedValue([{ id: 'b1', username: 'troll' }]),
    block: jest.fn().mockResolvedValue(undefined),
    unblock: jest.fn().mockResolvedValue(undefined),
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
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: BlocksService, useValue: blocksService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .overrideGuard(OptionalJwtAuthGuard)
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

  it('GET /users/:id -> 200, calls getPublicProfile(id, requesterId)', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/u2')
      .expect(200);

    expect(usersService.getPublicProfile).toHaveBeenCalledWith('u2', 'u-auth');
    expect(res.body).toEqual({ id: 'u2', username: 'bob' });
  });

  it('GET /users/:id/followers -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/u2/followers')
      .expect(200);

    expect(usersService.getFollowers).toHaveBeenCalledWith('u2');
    expect(res.body).toEqual([{ id: 'u3' }]);
  });

  it('GET /users/:id/following -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/u2/following')
      .expect(200);

    expect(usersService.getFollowing).toHaveBeenCalledWith('u2');
    expect(res.body).toEqual([{ id: 'u4' }]);
  });

  it('POST /users/:id/follow -> 201, calls follow(authUser, id)', async () => {
    await request(app.getHttpServer())
      .post('/users/u2/follow')
      .send({})
      .expect(201);

    expect(usersService.follow).toHaveBeenCalledWith('u-auth', 'u2');
  });

  it('DELETE /users/:id/follow -> 200, calls unfollow(authUser, id)', async () => {
    await request(app.getHttpServer())
      .delete('/users/u2/follow')
      .expect(200);

    expect(usersService.unfollow).toHaveBeenCalledWith('u-auth', 'u2');
  });

  it('PATCH /users/me -> 200, calls updateProfile(authUser, dto)', async () => {
    const dto = { bio: 'Hello world' };
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .send(dto)
      .expect(200);

    expect(usersService.updateProfile).toHaveBeenCalledWith('u-auth', { bio: 'Hello world' });
    expect(res.body).toHaveProperty('id', 'u-auth');
  });

  it('POST /users/:id/follow-requests -> 201, calls sendFollowRequest', async () => {
    await request(app.getHttpServer())
      .post('/users/u2/follow-requests')
      .send({})
      .expect(201);

    expect(usersService.sendFollowRequest).toHaveBeenCalledWith('u-auth', 'u2');
  });

  it('DELETE /users/:id/follow-requests -> 200, calls cancelFollowRequest', async () => {
    await request(app.getHttpServer())
      .delete('/users/u2/follow-requests')
      .expect(200);

    expect(usersService.cancelFollowRequest).toHaveBeenCalledWith('u-auth', 'u2');
  });

  it('POST /users/:id/follow-requests/accept -> 201, calls acceptFollowRequest', async () => {
    await request(app.getHttpServer())
      .post('/users/u2/follow-requests/accept')
      .send({})
      .expect(201);

    expect(usersService.acceptFollowRequest).toHaveBeenCalledWith('u-auth', 'u2');
  });

  it('POST /users/:id/follow-requests/decline -> 201, calls declineFollowRequest', async () => {
    await request(app.getHttpServer())
      .post('/users/u2/follow-requests/decline')
      .send({})
      .expect(201);

    expect(usersService.declineFollowRequest).toHaveBeenCalledWith('u-auth', 'u2');
  });

  it('GET /users/me/incoming-follow-requests -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/incoming-follow-requests')
      .expect(200);

    expect(usersService.getIncomingFollowRequests).toHaveBeenCalledWith('u-auth');
    expect(res.body).toEqual([{ id: 'fr1', fromUserId: 'u3' }]);
  });

  it('DELETE /users/me -> 200, calls deleteAccount(authUser) and returns success', async () => {
    const res = await request(app.getHttpServer())
      .delete('/users/me')
      .expect(200);

    expect(usersService.deleteAccount).toHaveBeenCalledWith('u-auth');
    expect(res.body).toEqual({ success: true });
  });

  it('DELETE /users/me -> 500 when deleteAccount throws', async () => {
    usersService.deleteAccount.mockRejectedValueOnce(new Error('boom'));

    await request(app.getHttpServer())
      .delete('/users/me')
      .expect(500);
  });

  it('GET /users/me/blocks -> 200, calls blocksService.listBlocked(authUser)', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/blocks')
      .expect(200);

    expect(blocksService.listBlocked).toHaveBeenCalledWith('u-auth');
    expect(res.body).toEqual([{ id: 'b1', username: 'troll' }]);
  });

  it('POST /users/:id/block -> 201, calls blocksService.block(authUser, id)', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/u2/block')
      .send({})
      .expect(201);

    expect(blocksService.block).toHaveBeenCalledWith('u-auth', 'u2');
    expect(res.body).toEqual({ success: true });
  });

  it('DELETE /users/:id/block -> 200, calls blocksService.unblock(authUser, id)', async () => {
    const res = await request(app.getHttpServer())
      .delete('/users/u2/block')
      .expect(200);

    expect(blocksService.unblock).toHaveBeenCalledWith('u-auth', 'u2');
    expect(res.body).toEqual({ success: true });
  });
});
