import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ReportsController } from '../../src/modules/reports/reports.controller';
import { ReportsService } from '../../src/modules/reports/reports.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { AdminGuard } from '../../src/common/guards/admin.guard';
import {
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '../../src/modules/reports/report.entity';

describe('Reports routes (integration)', () => {
  let app: INestApplication;
  const reportsService = {
    create: jest.fn().mockResolvedValue({
      id: 'r1',
      reporterId: 'u-auth',
      targetType: ReportTargetType.USER,
      targetId: 'target-1',
      reason: ReportReason.SPAM,
      status: ReportStatus.PENDING,
    }),
    list: jest.fn().mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]),
    updateStatus: jest.fn().mockResolvedValue({ id: 'r1', status: ReportStatus.REVIEWED }),
  };

  const authGuard: CanActivate = {
    canActivate: (ctx: ExecutionContext) => {
      const req = ctx.switchToHttp().getRequest();
      req.user = { id: 'u-auth', isAdmin: true };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: reportsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
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

  it('POST /reports -> 201, calls service.create with auth user id and dto', async () => {
    const dto = {
      targetType: 'user',
      targetId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      reason: 'spam',
      details: 'too much spam',
    };

    const res = await request(app.getHttpServer())
      .post('/reports')
      .send(dto)
      .expect(201);

    expect(reportsService.create).toHaveBeenCalledWith('u-auth', dto);
    expect(res.body).toHaveProperty('id', 'r1');
  });

  it('GET /reports -> 200, lists with optional status filter', async () => {
    const res = await request(app.getHttpServer())
      .get('/reports?status=pending')
      .expect(200);

    expect(reportsService.list).toHaveBeenCalledWith({ status: 'pending' });
    expect(res.body).toHaveLength(2);
  });

  it('GET /reports -> 200 without status returns all', async () => {
    await request(app.getHttpServer()).get('/reports').expect(200);
    expect(reportsService.list).toHaveBeenCalledWith({ status: undefined });
  });

  it('PATCH /reports/:id/status -> 200, updates status', async () => {
    const res = await request(app.getHttpServer())
      .patch('/reports/r1/status')
      .send({ status: 'reviewed' })
      .expect(200);

    expect(reportsService.updateStatus).toHaveBeenCalledWith('r1', 'reviewed');
    expect(res.body).toEqual({ id: 'r1', status: ReportStatus.REVIEWED });
  });

  it('POST /reports -> 500 when service throws', async () => {
    reportsService.create.mockRejectedValueOnce(new Error('boom'));

    await request(app.getHttpServer())
      .post('/reports')
      .send({
        targetType: 'user',
        targetId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        reason: 'other',
      })
      .expect(500);
  });
});
