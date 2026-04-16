import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me/incoming-follow-requests')
  @UseGuards(JwtAuthGuard)
  getIncomingFollowRequests(@CurrentUser() user: User) {
    return this.usersService.getIncomingFollowRequests(user.id);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  searchUsers(@Query('q') q: string, @CurrentUser() user: User) {
    return this.usersService.searchByUsername(q ?? '', user.id);
  }

  @Post(':id/follow-requests')
  @UseGuards(JwtAuthGuard)
  sendFollowRequest(@Param('id') targetId: string, @CurrentUser() user: User) {
    return this.usersService.sendFollowRequest(user.id, targetId);
  }

  @Delete(':id/follow-requests')
  @UseGuards(JwtAuthGuard)
  cancelFollowRequest(@Param('id') targetId: string, @CurrentUser() user: User) {
    return this.usersService.cancelFollowRequest(user.id, targetId);
  }

  @Post(':id/follow-requests/accept')
  @UseGuards(JwtAuthGuard)
  acceptFollowRequest(@Param('id') requesterId: string, @CurrentUser() user: User) {
    return this.usersService.acceptFollowRequest(user.id, requesterId);
  }

  @Post(':id/follow-requests/decline')
  @UseGuards(JwtAuthGuard)
  declineFollowRequest(@Param('id') requesterId: string, @CurrentUser() user: User) {
    return this.usersService.declineFollowRequest(user.id, requesterId);
  }

  /** Public profile — avec JWT optionnel : isFollowing, demandes de connexion. */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getPublicProfile(
    @Param('id') id: string,
    @Request() req: { user?: User },
  ) {
    const requesterId = req.user?.id;
    return this.usersService.getPublicProfile(id, requesterId);
  }

  @Get(':id/followers')
  getFollowers(@Param('id') id: string) {
    return this.usersService.getFollowers(id);
  }

  @Get(':id/following')
  getFollowing(@Param('id') id: string) {
    return this.usersService.getFollowing(id);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('id') targetId: string, @CurrentUser() user: User) {
    return this.usersService.follow(user.id, targetId);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  unfollow(@Param('id') targetId: string, @CurrentUser() user: User) {
    return this.usersService.unfollow(user.id, targetId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }
}
