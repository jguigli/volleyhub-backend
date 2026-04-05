import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Match, MatchStatus } from '../matches/match.entity';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsCron {
  private readonly logger = new Logger(NotificationsCron.name);

  constructor(
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('*/5 * * * *')
  async handleReminder30min() {
    const now = new Date();
    const from = new Date(now.getTime() + 25 * 60 * 1000);
    const to = new Date(now.getTime() + 30 * 60 * 1000);

    const matches = await this.matchRepo.find({
      where: [
        { status: MatchStatus.OPEN, scheduledAt: Between(from, to) },
        { status: MatchStatus.FULL, scheduledAt: Between(from, to) },
      ],
    });

    for (const match of matches) {
      const flagKey = `reminder:sent:${match.id}`;
      const already = await this.redis.get(flagKey);
      if (already) continue;

      await this.redis.set(flagKey, '1', 3600);
      try {
        await this.notifications.notifyEventReminder30min(match);
        this.logger.log(`30min reminder sent for match ${match.id}`);
      } catch (err) {
        this.logger.error(`Reminder failed for ${match.id}`, err);
      }
    }
  }
}
