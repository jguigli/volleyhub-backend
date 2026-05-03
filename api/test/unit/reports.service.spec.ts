import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportsService } from '../../src/modules/reports/reports.service';
import {
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '../../src/modules/reports/report.entity';

describe('ReportsService (unit)', () => {
  let service: ReportsService;
  let reportRepo: Record<string, jest.Mock>;
  let userRepo: Record<string, jest.Mock>;
  let chatRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    reportRepo = {
      create: jest.fn((data: any) => ({ ...data, id: 'report-1' })),
      save: jest.fn((data: any) => Promise.resolve({ ...data, id: 'report-1' })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    userRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'target-1', username: 'target' }),
    };
    chatRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'msg-1',
        userId: 'other-user',
        body: 'hi',
      }),
    };

    service = new ReportsService(reportRepo as any, userRepo as any, chatRepo as any);
  });

  describe('create — user target', () => {
    it('should create a report for a valid user target', async () => {
      const result = await service.create('reporter-1', {
        targetType: ReportTargetType.USER,
        targetId: 'target-1',
        reason: ReportReason.SPAM,
        details: 'too much spam',
      });

      expect(reportRepo.save).toHaveBeenCalled();
      expect(result.reporterId).toBe('reporter-1');
      expect(result.targetType).toBe(ReportTargetType.USER);
      expect(result.reason).toBe(ReportReason.SPAM);
      expect(result.status).toBe(ReportStatus.PENDING);
    });

    it('should throw BadRequestException when reporting yourself', async () => {
      await expect(
        service.create('reporter-1', {
          targetType: ReportTargetType.USER,
          targetId: 'reporter-1',
          reason: ReportReason.SPAM,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when target user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('reporter-1', {
          targetType: ReportTargetType.USER,
          targetId: 'nope',
          reason: ReportReason.OTHER,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create — chat_message target', () => {
    it('should create a report for a valid chat message', async () => {
      const result = await service.create('reporter-1', {
        targetType: ReportTargetType.CHAT_MESSAGE,
        targetId: 'msg-1',
        reason: ReportReason.HARASSMENT,
      });

      expect(result.targetType).toBe(ReportTargetType.CHAT_MESSAGE);
      expect(result.reason).toBe(ReportReason.HARASSMENT);
    });

    it('should throw NotFoundException when message does not exist', async () => {
      chatRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('reporter-1', {
          targetType: ReportTargetType.CHAT_MESSAGE,
          targetId: 'gone',
          reason: ReportReason.OTHER,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when reporting your own message', async () => {
      chatRepo.findOne.mockResolvedValue({ id: 'msg-1', userId: 'reporter-1', body: 'hi' });
      await expect(
        service.create('reporter-1', {
          targetType: ReportTargetType.CHAT_MESSAGE,
          targetId: 'msg-1',
          reason: ReportReason.SPAM,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('list', () => {
    it('should query reports filtered by status with pagination defaults', async () => {
      reportRepo.find.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
      const result = await service.list({ status: ReportStatus.PENDING });

      expect(reportRepo.find).toHaveBeenCalledWith({
        where: { status: ReportStatus.PENDING },
        relations: ['reporter'],
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(result).toHaveLength(2);
    });

    it('should apply custom limit and offset', async () => {
      await service.list({ limit: 10, offset: 20 });
      expect(reportRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20, where: {} }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should update the report status', async () => {
      const existing = { id: 'r1', status: ReportStatus.PENDING };
      reportRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateStatus('r1', ReportStatus.REVIEWED);

      expect(reportRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReportStatus.REVIEWED }),
      );
      expect(result.status).toBe(ReportStatus.REVIEWED);
    });

    it('should throw NotFoundException when report does not exist', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus('nope', ReportStatus.DISMISSED),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
