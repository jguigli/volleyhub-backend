import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsCron } from './notifications.cron';
import { RedisModule } from '../redis/redis.module';
import { User } from '../users/user.entity';
import { Match } from '../matches/match.entity';
import { MatchParticipant } from '../matches/match-participant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Match, MatchParticipant]),
    RedisModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsCron],
  exports: [NotificationsService],
})
export class NotificationsModule {}
