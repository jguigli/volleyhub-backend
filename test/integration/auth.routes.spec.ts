import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthService } from '../../src/modules/auth/auth.service';

describe('Auth routes (integration)', () => {
  let app: INestApplication;
  const authService = {
    register: jest.fn().mockResolvedValue({ id: 'u1' }),
    login: jest.fn().mockResolvedValue({ accessToken: 'token' }),
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

  it('POST /auth/register', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'seed@test.local', password: '123456', username: 'seed' })
      .expect(201);
    expect(authService.register).toHaveBeenCalled();
  });

  it('POST /auth/login', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'seed@test.local', password: '123456' })
      .expect(201);
    expect(authService.login).toHaveBeenCalled();
  });
});
