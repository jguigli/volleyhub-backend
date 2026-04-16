import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @Header('Access-Control-Expose-Headers', 'X-Total-Count')
  async listUsers(
    @Query('_start') start?: string,
    @Query('_end') end?: string,
    @Query('_sort') sort?: string,
    @Query('_order') order?: 'ASC' | 'DESC',
    @Query('q') q?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const { data, total } = await this.adminService.listUsers({
      start: start ? parseInt(start, 10) : 0,
      end: end ? parseInt(end, 10) : 10,
      sort,
      order,
      q,
    });
    res?.setHeader('X-Total-Count', String(total));
    return data;
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Get('matches')
  @Header('Access-Control-Expose-Headers', 'X-Total-Count')
  async listMatches(
    @Query('_start') start?: string,
    @Query('_end') end?: string,
    @Query('_sort') sort?: string,
    @Query('_order') order?: 'ASC' | 'DESC',
    @Res({ passthrough: true }) res?: Response,
  ) {
    const { data, total } = await this.adminService.listMatches({
      start: start ? parseInt(start, 10) : 0,
      end: end ? parseInt(end, 10) : 10,
      sort,
      order,
    });
    res?.setHeader('X-Total-Count', String(total));
    return data;
  }

  @Get('matches/:id')
  getMatch(@Param('id') id: string) {
    return this.adminService.getMatch(id);
  }

  @Delete('matches/:id')
  async deleteMatch(@Param('id') id: string): Promise<{ id: string }> {
    await this.adminService.deleteMatch(id);
    return { id };
  }
}
