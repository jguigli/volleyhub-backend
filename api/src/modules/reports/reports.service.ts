import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportStatus, ReportTargetType } from './report.entity';
import { User } from '../users/user.entity';
import { MatchChatMessage } from '../matches/match-chat-message.entity';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MatchChatMessage)
    private readonly chatRepo: Repository<MatchChatMessage>,
  ) {}

  async create(reporterId: string, dto: CreateReportDto): Promise<Report> {
    // Verify target exists
    if (dto.targetType === ReportTargetType.USER) {
      if (dto.targetId === reporterId) {
        throw new BadRequestException('You cannot report yourself');
      }
      const target = await this.userRepo.findOne({ where: { id: dto.targetId } });
      if (!target) throw new NotFoundException('User not found');
    } else if (dto.targetType === ReportTargetType.CHAT_MESSAGE) {
      const msg = await this.chatRepo.findOne({ where: { id: dto.targetId } });
      if (!msg) throw new NotFoundException('Chat message not found');
      if (msg.userId === reporterId) {
        throw new BadRequestException('You cannot report your own message');
      }
    }

    const report = this.reportRepo.create({
      reporterId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: dto.reason,
      details: dto.details ?? null,
      status: ReportStatus.PENDING,
    });
    return this.reportRepo.save(report);
  }

  async list(filters: {
    status?: ReportStatus;
    limit?: number;
    offset?: number;
  }): Promise<Report[]> {
    return this.reportRepo.find({
      where: filters.status ? { status: filters.status } : {},
      relations: ['reporter'],
      order: { createdAt: 'DESC' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });
  }

  async updateStatus(id: string, status: ReportStatus): Promise<Report> {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    report.status = status;
    return this.reportRepo.save(report);
  }
}
