import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { ReportStatus } from './report.entity';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.id, dto);
  }

  // Admin endpoints — review the moderation queue
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  list(@Query('status') status?: ReportStatus) {
    return this.reportsService.list({ status });
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateStatus(@Param('id') id: string, @Body('status') status: ReportStatus) {
    return this.reportsService.updateStatus(id, status);
  }
}
