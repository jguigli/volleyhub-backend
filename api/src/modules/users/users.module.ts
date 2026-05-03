import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { BlocksService } from './blocks.service';
import { User } from './user.entity';
import { Follow } from './follow.entity';
import { FollowRequest } from './follow-request.entity';
import { UserBlock } from './user-block.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Follow, FollowRequest, UserBlock]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, BlocksService],
  exports: [UsersService, BlocksService, TypeOrmModule],
})
export class UsersModule {}
