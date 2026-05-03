import { ReportsController } from '../../src/modules/reports/reports.controller';
import {
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '../../src/modules/reports/report.entity';

describe('ReportsController (unit)', () => {
  let controller: ReportsController;
  let service: Record<string, jest.Mock>;
  const fakeUser = { id: 'user-1', username: 'reporter' };

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'r1' }),
      list: jest.fn().mockResolvedValue([{ id: 'r1' }]),
      updateStatus: jest.fn().mockResolvedValue({ id: 'r1', status: ReportStatus.REVIEWED }),
    };
    controller = new ReportsController(service as any);
  });

  describe('create', () => {
    it('should call service.create with current user id and dto', async () => {
      const dto = {
        targetType: ReportTargetType.USER,
        targetId: 'target-1',
        reason: ReportReason.SPAM,
      };
      const result = await controller.create(fakeUser as any, dto as any);

      expect(service.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({ id: 'r1' });
    });
  });

  describe('list (admin)', () => {
    it('should pass through the status filter', async () => {
      await controller.list(ReportStatus.PENDING);
      expect(service.list).toHaveBeenCalledWith({ status: ReportStatus.PENDING });
    });

    it('should pass undefined when no status filter given', async () => {
      await controller.list();
      expect(service.list).toHaveBeenCalledWith({ status: undefined });
    });
  });

  describe('updateStatus (admin)', () => {
    it('should delegate to service.updateStatus', async () => {
      const result = await controller.updateStatus('r1', ReportStatus.REVIEWED);
      expect(service.updateStatus).toHaveBeenCalledWith('r1', ReportStatus.REVIEWED);
      expect(result.status).toBe(ReportStatus.REVIEWED);
    });
  });
});
