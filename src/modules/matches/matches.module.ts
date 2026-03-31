import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchesGateway } from './matches.gateway';
import { MatchChatService } from './match-chat.service';
import { Match } from './match.entity';
import { MatchParticipant } from './match-participant.entity';
import { MatchChatMessage } from './match-chat-message.entity';
import { MatchChatMute } from './match-chat-mute.entity';
import { TournamentFixtureMatch } from './tournament-fixture.entity';
import { TournamentGeneratorService } from './tournament-generator.service';
import { TournamentEngineService } from './tournament-engine.service';
import { RedisModule } from '../redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Match,
      MatchParticipant,
      MatchChatMessage,
      MatchChatMute,
      TournamentFixtureMatch,
      User,
    ]),
    RedisModule,
    NotificationsModule,
    AuthModule,
  ],
  controllers: [MatchesController],
  providers: [
    MatchesService,
    MatchesGateway,
    MatchChatService,
    TournamentGeneratorService,
    TournamentEngineService,
  ],
  exports: [MatchesService],
})
export class MatchesModule {}
