import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getAll(@CurrentUser() user: User) {
    return this.notificationsService.getNotifications(user.id);
  }

  @Delete(':id')
  async dismiss(@CurrentUser() user: User, @Param('id') id: string) {
    await this.notificationsService.dismissNotification(user.id, id);
    return { ok: true };
  }
}
