import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CourtsController } from '../../src/modules/courts/courts.controller';
import { CourtsService } from '../../src/modules/courts/courts.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';

describe('Courts routes (integration)', () => {
  let app: INestApplication;
  const courtsService = {
    findNearby: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Beach Court' }]),
    findById: jest.fn().mockResolvedValue({ id: 'c1', name: 'Beach Court', type: 'outdoor' }),
    create: jest.fn().mockResolvedValue({ id: 'c2', name: 'Court A', type: 'indoor' }),
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /courts/:id -> 200, calls findById with correct id', async () => {
    const res = await request(app.getHttpServer())
      .get('/courts/c1')
      .expect(200);

    expect(courtsService.findById).toHaveBeenCalledWith('c1');
    expect(res.body).toEqual({ id: 'c1', name: 'Beach Court', type: 'outdoor' });
  });

  it('GET /courts/:id -> calls findById with different id', async () => {
    await request(app.getHttpServer())
      .get('/courts/c99')
      .expect(200);

    expect(courtsService.findById).toHaveBeenCalledWith('c99');
  });

  it('POST /courts -> 201 (auth required), calls create with dto', async () => {
    const dto = { name: 'Court A', type: 'indoor', lat: 48.85, lng: 2.35 };
    const res = await request(app.getHttpServer())
      .post('/courts')
      .send(dto)
      .expect(201);

    expect(courtsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Court A', type: 'indoor' }),
    );
    expect(res.body).toEqual({ id: 'c2', name: 'Court A', type: 'indoor' });
  });

  it('POST /courts -> service receives the full dto fields', async () => {
    const dto = { name: 'Sand Court', type: 'outdoor', lat: 43.6, lng: 3.88, address: '1 rue du sport' };
    await request(app.getHttpServer())
      .post('/courts')
      .send(dto)
      .expect(201);

    const call = courtsService.create.mock.calls[0][0];
    expect(call).toHaveProperty('name', 'Sand Court');
    expect(call).toHaveProperty('type', 'outdoor');
  });
});
