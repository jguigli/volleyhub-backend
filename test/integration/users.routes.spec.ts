import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UsersController } from '../../src/modules/users/users.controller';
import { UsersService } from '../../src/modules/users/users.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../src/common/guards/optional-jwt-auth.guard';

describe('Users routes (integration)', () => {
  let app: INestApplication;
  const usersService = {
    getIncomingFollowRequests: jest.fn().mockResolvedValue([]),
    sendFollowRequest: jest.fn().mockResolvedValue({ ok: true }),
    cancelFollowRequest: jest.fn().mockResolvedValue({ ok: true }),
    acceptFollowRequest: jest.fn().mockResolvedValue({ ok: true }),
    declineFollowRequest: jest.fn().mockResolvedValue({ ok: true }),
    getPublicProfile: jest.fn().mockResolvedValue({ id: 'u2' }),
    getFollowers: jest.fn().mockResolvedValue([]),
    getFollowing: jest.fn().mockResolvedValue([]),
    follow: jest.fn().mockResolvedValue({ ok: true }),
    unfollow: jest.fn().mockResolvedValue({ ok: true }),
    updateProfile: jest.fn().mockResolvedValue({ id: 'u-auth' }),
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
      providers: [{ provide: UsersService, useValue: usersService }],
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

  it('covers users routes', async () => {
    await request(app.getHttpServer()).get('/users/me/incoming-follow-requests').expect(200);
    await request(app.getHttpServer()).post('/users/u2/follow-requests').send({}).expect(201);
    await request(app.getHttpServer()).delete('/users/u2/follow-requests').expect(200);
    await request(app.getHttpServer()).post('/users/u2/follow-requests/accept').send({}).expect(201);
    await request(app.getHttpServer()).post('/users/u2/follow-requests/decline').send({}).expect(201);
    await request(app.getHttpServer()).get('/users/u2').expect(200);
    await request(app.getHttpServer()).get('/users/u2/followers').expect(200);
    await request(app.getHttpServer()).get('/users/u2/following').expect(200);
    await request(app.getHttpServer()).post('/users/u2/follow').send({}).expect(201);
    await request(app.getHttpServer()).delete('/users/u2/follow').expect(200);
    await request(app.getHttpServer()).patch('/users/me').send({ bio: 'Hello' }).expect(200);

    expect(usersService.getIncomingFollowRequests).toHaveBeenCalled();
    expect(usersService.sendFollowRequest).toHaveBeenCalledWith('u-auth', 'u2');
    expect(usersService.cancelFollowRequest).toHaveBeenCalledWith('u-auth', 'u2');
    expect(usersService.acceptFollowRequest).toHaveBeenCalledWith('u-auth', 'u2');
    expect(usersService.declineFollowRequest).toHaveBeenCalledWith('u-auth', 'u2');
    expect(usersService.getPublicProfile).toHaveBeenCalled();
    expect(usersService.getFollowers).toHaveBeenCalledWith('u2');
    expect(usersService.getFollowing).toHaveBeenCalledWith('u2');
    expect(usersService.follow).toHaveBeenCalledWith('u-auth', 'u2');
    expect(usersService.unfollow).toHaveBeenCalledWith('u-auth', 'u2');
    expect(usersService.updateProfile).toHaveBeenCalledWith('u-auth', { bio: 'Hello' });
  });
});
