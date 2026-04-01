import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchChatService } from './match-chat.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchManageDto } from './dto/update-match-manage.dto';
import { UpdateMyTeamDto } from './dto/update-my-team.dto';
import { FindMatchesDto } from './dto/find-matches.dto';
import { PostMatchChatMessageDto } from './dto/post-match-chat-message.dto';
import { MuteMatchChatUserDto } from './dto/mute-match-chat-user.dto';
import { RemoveMatchParticipantDto } from './dto/remove-match-participant.dto';
import { InvitePlayerDto } from './dto/invite-player.dto';
import { SubmitFixtureScoreDto } from './dto/submit-fixture-score.dto';
import { OverrideFixtureScoreDto } from './dto/override-fixture-score.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { EventFormat } from '../../common/enums';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly matchChatService: MatchChatService,
  ) {}

  @Get()
  findNearby(@Query() query: FindMatchesDto) {
    return this.matchesService.findNearby(query);
  }

  @Get('suggestions')
  @UseGuards(JwtAuthGuard)
  getSuggestions(@CurrentUser() user: User, @Query() query: FindMatchesDto) {
    return this.matchesService.getSuggestions(user.id, query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyMatches(@CurrentUser() user: User) {
    return this.matchesService.getMyMatches(user.id);
  }

  @Get('incoming-invites')
  @UseGuards(JwtAuthGuard)
  getIncomingInvites(@CurrentUser() user: User) {
    return this.matchesService.getIncomingInvites(user.id);
  }

  @Delete('incoming-invites/:inviteId')
  @UseGuards(JwtAuthGuard)
  dismissIncomingInvite(
    @CurrentUser() user: User,
    @Param('inviteId') inviteId: string,
  ) {
    return this.matchesService.dismissIncomingInvite(user.id, inviteId);
  }

  @Get('user/:userId/stats')
  getUserMatchStats(
    @Param('userId') userId: string,
    @Query('eventFormat') eventFormat?: string,
  ) {
    const safeFormat: EventFormat | undefined =
      eventFormat === 'match' || eventFormat === 'tournament'
        ? (eventFormat as EventFormat)
        : undefined;
    return this.matchesService.getUserMatchStatsByFormat(userId, safeFormat);
  }

  @Post('fixtures/:fixtureId/score')
  @UseGuards(JwtAuthGuard)
  submitFixtureScore(
    @Param('fixtureId') fixtureId: string,
    @CurrentUser() user: User,
    @Body() dto: SubmitFixtureScoreDto,
  ) {
    return this.matchesService.submitFixtureScore(fixtureId, user.id, dto.score);
  }

  @Post('fixtures/:fixtureId/confirm')
  @UseGuards(JwtAuthGuard)
  confirmFixtureScore(
    @Param('fixtureId') fixtureId: string,
    @CurrentUser() user: User,
  ) {
    return this.matchesService.confirmFixtureScore(fixtureId, user.id);
  }

  @Patch('fixtures/:fixtureId/override')
  @UseGuards(JwtAuthGuard)
  overrideFixtureScore(
    @Param('fixtureId') fixtureId: string,
    @CurrentUser() user: User,
    @Body() dto: OverrideFixtureScoreDto,
  ) {
    return this.matchesService.organizerOverrideFixtureScore(
      fixtureId,
      user.id,
      dto.scoreA,
      dto.scoreB,
    );
  }

  @Get(':id/chat/messages')
  @UseGuards(JwtAuthGuard)
  getChatMessages(
    @Param('id') matchId: string,
    @CurrentUser() user: User,
    @Query('before') before?: string,
  ) {
    return this.matchChatService.listMessages(matchId, user.id, before);
  }

  @Get(':id/chat/muted-user-ids')
  @UseGuards(JwtAuthGuard)
  getChatMutedUserIds(
    @Param('id') matchId: string,
    @CurrentUser() user: User,
  ) {
    return this.matchChatService.listMutedUserIds(matchId, user.id);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.matchesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateMatchDto) {
    return this.matchesService.create(user.id, dto);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  join(@Param('id') id: string, @CurrentUser() user: User) {
    return this.matchesService.join(id, user.id);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  leave(@Param('id') id: string, @CurrentUser() user: User) {
    return this.matchesService.leave(id, user.id);
  }

  @Post(':id/remove-participant')
  @UseGuards(JwtAuthGuard)
  removeParticipant(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: RemoveMatchParticipantDto,
  ) {
    return this.matchesService.removeParticipant(id, user.id, dto.userId);
  }

  @Post(':id/invite')
  @UseGuards(JwtAuthGuard)
  invitePlayer(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: InvitePlayerDto,
  ) {
    return this.matchesService.invitePlayer(id, user.id, dto.userId);
  }

  @Get(':id/sent-invites')
  @UseGuards(JwtAuthGuard)
  getSentInvites(@Param('id') id: string, @CurrentUser() user: User) {
    return this.matchesService.getSentInviteUserIds(id, user.id);
  }

  @Post(':id/chat/messages')
  @UseGuards(JwtAuthGuard)
  postChatMessage(
    @Param('id') matchId: string,
    @CurrentUser() user: User,
    @Body() dto: PostMatchChatMessageDto,
  ) {
    return this.matchChatService.postMessage(matchId, user.id, dto.body);
  }

  @Post(':id/chat/mute')
  @UseGuards(JwtAuthGuard)
  muteChatUser(
    @Param('id') matchId: string,
    @CurrentUser() user: User,
    @Body() dto: MuteMatchChatUserDto,
  ) {
    return this.matchChatService.muteUser(matchId, user.id, dto.userId);
  }

  @Delete(':id/chat/mute/:userId')
  @UseGuards(JwtAuthGuard)
  unmuteChatUser(
    @Param('id') matchId: string,
    @CurrentUser() user: User,
    @Param('userId') targetUserId: string,
  ) {
    return this.matchChatService.unmuteUser(matchId, user.id, targetUserId);
  }

  @Patch(':id/manage')
  @UseGuards(JwtAuthGuard)
  manage(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateMatchManageDto,
  ) {
    return this.matchesService.updateManage(id, user.id, dto);
  }

  @Patch(':id/my-team')
  @UseGuards(JwtAuthGuard)
  setMyTeam(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateMyTeamDto,
  ) {
    return this.matchesService.setMyTeam(id, user.id, dto.teamIndex);
  }

  @Post(':id/renew')
  @UseGuards(JwtAuthGuard)
  renew(@Param('id') id: string, @CurrentUser() user: User) {
    return this.matchesService.renewMatch(id, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.matchesService.deleteMatch(id, user.id);
  }
}
