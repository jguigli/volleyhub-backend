import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthService } from '../../src/modules/auth/auth.service';

describe('Auth routes (integration)', () => {
  let app: INestApplication;
  const authService = {
    register: jest.fn().mockResolvedValue({ id: 'u1', email: 'seed@test.local', username: 'seed' }),
    login: jest.fn().mockResolvedValue({ accessToken: 'at-123', refreshToken: 'rt-456' }),
    refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: 'at-789' }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /auth/register -> 201, calls register with dto', async () => {
    const dto = { email: 'seed@test.local', password: '123456', username: 'seed' };
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(dto)
      .expect(201);

    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'seed@test.local', password: '123456', username: 'seed' }),
    );
    expect(res.body).toEqual({ id: 'u1', email: 'seed@test.local', username: 'seed' });
  });

  it('POST /auth/login -> 201, calls login with dto', async () => {
    const dto = { email: 'seed@test.local', password: '123456' };
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(dto)
      .expect(201);

    expect(authService.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'seed@test.local', password: '123456' }),
    );
    expect(res.body).toHaveProperty('accessToken', 'at-123');
    expect(res.body).toHaveProperty('refreshToken', 'rt-456');
  });

  it('POST /auth/refresh -> 201, calls refreshAccessToken with refreshToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'rt-456' })
      .expect(201);

    expect(authService.refreshAccessToken).toHaveBeenCalledWith('rt-456');
    expect(res.body).toHaveProperty('accessToken', 'at-789');
  });

  it('POST /auth/register with empty body -> should still call service (validation is in pipes)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({})
      .expect(201);

    expect(authService.register).toHaveBeenCalledWith(expect.any(Object));
  });

  it('POST /auth/login response body contains accessToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.c', password: 'pw' })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('POST /auth/refresh response body contains accessToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'any-token' })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
  });
});
