import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserAwareThrottlerGuard } from './common/guards/user-aware-throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CourtsModule } from './modules/courts/courts.module';
import { MatchesModule } from './modules/matches/matches.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ContentFilterModule } from './common/content-filter/content-filter.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from './modules/redis/redis.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('app.nodeEnv') === 'production';
        return {
          type: 'postgres',
          url: config.get<string>('database.url'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          synchronize: !isProd,
          migrationsRun: isProd,
          logging: false,
          ssl: isProd ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 200 },
    ]),
    ScheduleModule.forRoot(),
    RedisModule,
    AuthModule,
    UsersModule,
    CourtsModule,
    MatchesModule,
    NotificationsModule,
    AdminModule,
    ReportsModule,
    ContentFilterModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
  ],
})
export class AppModule {}
