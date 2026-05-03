import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchChatMessage } from './match-chat-message.entity';
import { MatchChatMute } from './match-chat-mute.entity';
import { MatchesService } from './matches.service';
import { MatchesGateway } from './matches.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { BlocksService } from '../users/blocks.service';
import { ContentFilterService } from '../../common/content-filter/content-filter.service';

const CHAT_PAGE = 50;

@Injectable()
export class MatchChatService {
  constructor(
    @InjectRepository(MatchChatMessage)
    private readonly messageRepo: Repository<MatchChatMessage>,
    @InjectRepository(MatchChatMute)
    private readonly muteRepo: Repository<MatchChatMute>,
    private readonly matchesService: MatchesService,
    @Inject(forwardRef(() => MatchesGateway))
    private readonly matchesGateway: MatchesGateway,
    private readonly notificationsService: NotificationsService,
    private readonly blocksService: BlocksService,
    private readonly contentFilter: ContentFilterService,
  ) {}

  async assertParticipant(matchId: string, userId: string): Promise<void> {
    const match = await this.matchesService.findById(matchId);
    const ok =
      match.creatorId === userId ||
      match.participants.some((p) => p.userId === userId);
    if (!ok) {
      throw new ForbiddenException('You must join this event to use the chat');
    }
  }

  async isMuted(matchId: string, userId: string): Promise<boolean> {
    const row = await this.muteRepo.findOne({
      where: { matchId, mutedUserId: userId },
    });
    return row != null;
  }

  async listMessages(matchId: string, viewerId: string, before?: string) {
    await this.assertParticipant(matchId, viewerId);
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'u')
      .where('m.matchId = :matchId', { matchId })
      .orderBy('m.createdAt', 'DESC')
      .take(CHAT_PAGE + 1);

    if (before) {
      const ref = await this.messageRepo.findOne({
        where: { id: before, matchId },
      });
      if (ref) {
        qb.andWhere('m.createdAt < :beforeTs', { beforeTs: ref.createdAt });
      }
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > CHAT_PAGE;
    const slice = hasMore ? rows.slice(0, CHAT_PAGE) : rows;

    // Filter out messages from users who blocked or are blocked by the viewer
    const blockedIds = await this.blocksService.getBlockedAndBlockerIds(viewerId);
    const filtered = slice.filter((msg) => !blockedIds.has(msg.userId));

    return {
      messages: filtered.reverse().map((msg) => ({
        id: msg.id,
        matchId: msg.matchId,
        userId: msg.userId,
        body: msg.body,
        createdAt: msg.createdAt.toISOString(),
        user: {
          id: msg.user.id,
          username: msg.user.username,
          profilePicture: msg.user.profilePicture,
        },
      })),
      hasMore,
    };
  }

  async postMessage(matchId: string, userId: string, body: string) {
    await this.assertParticipant(matchId, userId);
    if (await this.isMuted(matchId, userId)) {
      throw new ForbiddenException('You are muted in this chat');
    }
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('Message cannot be empty');
    }
    this.contentFilter.assertClean(trimmed, 'Message');

    const msg = this.messageRepo.create({
      matchId,
      userId,
      body: trimmed.slice(0, 2000),
    });
    const saved = await this.messageRepo.save(msg);
    const full = await this.messageRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    if (!full?.user) {
      throw new NotFoundException('Message not found');
    }

    const payload = {
      id: full.id,
      matchId: full.matchId,
      userId: full.userId,
      body: full.body,
      createdAt: full.createdAt.toISOString(),
      user: {
        id: full.user.id,
        username: full.user.username,
        profilePicture: full.user.profilePicture,
      },
    };

    // Compute the set of users who must NOT receive this message
    // (users who blocked the sender or whom the sender blocked).
    const blockedSet = await this.blocksService.getBlockedAndBlockerIds(userId);
    const excludeUserIds = Array.from(blockedSet);

    this.matchesGateway.broadcastChatMessage(matchId, payload, excludeUserIds);

    // Push notification to other participants (fire-and-forget),
    // skipping the same blocked-related users.
    void this.notificationsService.notifyChatMessage(
      matchId,
      userId,
      payload.user.username,
      excludeUserIds,
    );

    return payload;
  }

  async listMutedUserIds(matchId: string, organizerId: string): Promise<string[]> {
    const match = await this.matchesService.findById(matchId);
    if (match.creatorId !== organizerId) {
      throw new ForbiddenException('Only the organizer can view mutes');
    }
    const rows = await this.muteRepo.find({ where: { matchId } });
    return rows.map((r) => r.mutedUserId);
  }

  async muteUser(matchId: string, organizerId: string, targetUserId: string) {
    const match = await this.matchesService.findById(matchId);
    if (match.creatorId !== organizerId) {
      throw new ForbiddenException('Only the organizer can mute players');
    }
    if (targetUserId === organizerId) {
      throw new BadRequestException('Cannot mute yourself');
    }
    const isParticipant =
      match.participants.some((p) => p.userId === targetUserId);
    if (!isParticipant) {
      throw new BadRequestException('User is not a participant');
    }
    await this.muteRepo.save({
      matchId,
      mutedUserId: targetUserId,
    });
    return { ok: true };
  }

  async unmuteUser(matchId: string, organizerId: string, targetUserId: string) {
    const match = await this.matchesService.findById(matchId);
    if (match.creatorId !== organizerId) {
      throw new ForbiddenException('Only the organizer can unmute players');
    }
    await this.muteRepo.delete({ matchId, mutedUserId: targetUserId });
    return { ok: true };
  }

  async clearMutesForUser(matchId: string, userId: string): Promise<void> {
    await this.muteRepo.delete({ matchId, mutedUserId: userId });
  }
}
