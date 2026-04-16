import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminSeederService } from './admin-seeder.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { User } from '../users/user.entity';
import { Match } from '../matches/match.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Match])],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, AdminSeederService],
})
export class AdminModule {}
