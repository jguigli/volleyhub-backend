import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CourtsController } from '../../src/modules/courts/courts.controller';
import { CourtsService } from '../../src/modules/courts/courts.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';

describe('Courts routes (integration)', () => {
  let app: INestApplication;
  const courtsService = {
    findNearby: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 'c1' }),
    create: jest.fn().mockResolvedValue({ id: 'c2' }),
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
      controllers: [CourtsController],
      providers: [{ provide: CourtsService, useValue: courtsService }],
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

  it('GET /courts', async () => {
    await request(app.getHttpServer()).get('/courts?lat=48.85&lng=2.35').expect(200);
    expect(courtsService.findNearby).toHaveBeenCalled();
  });

  it('GET /courts/:id', async () => {
    await request(app.getHttpServer()).get('/courts/c1').expect(200);
    expect(courtsService.findById).toHaveBeenCalledWith('c1');
  });

  it('POST /courts', async () => {
    await request(app.getHttpServer())
      .post('/courts')
      .send({ name: 'Court A', type: 'indoor', lat: 48.85, lng: 2.35 })
      .expect(201);
    expect(courtsService.create).toHaveBeenCalled();
  });
});
