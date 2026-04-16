import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { User } from '../users/user.entity';
import { Match } from '../matches/match.entity';
import { MatchParticipant } from '../matches/match-participant.entity';
import { RedisService } from '../redis/redis.service';

const NOTIF_TTL = 60 * 60 * 24 * 30; // 30 days
const NOTIF_MAX = 200;

export type NotificationType =
  | 'player_joined'
  | 'match_almost_full'
  | 'event_invite'
  | 'match_renewed_invite'
  | 'event_settings_changed'
  | 'event_started_early'
  | 'event_deleted'
  | 'player_removed'
  | 'event_full'
  | 'event_completed'
  | 'opponent_score_locked'
  | 'score_overridden'
  | 'connection_accepted'
  | 'player_left_event'
  | 'event_reminder_30min'
  | 'chat_message'
  | 'event_cancelled_not_enough_players';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  matchId?: string;
  actorUsername?: string;
  actorId?: string;
  extra?: Record<string, string>;
  createdAt: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseReady = false;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MatchParticipant)
    private readonly participantRepo: Repository<MatchParticipant>,
  ) {}

  onModuleInit() {
    const projectId = this.config.get<string>('app.firebase.projectId');
    const privateKey = this.config.get<string>('app.firebase.privateKey');
    const clientEmail = this.config.get<string>('app.firebase.clientEmail');
    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn('Firebase config missing \u2014 push notifications disabled');
      return;
    }
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({ projectId, privateKey, clientEmail }),
        });
      }
      this.firebaseReady = true;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (err) {
      this.logger.warn('Firebase init failed: ' + String(err));
    }
  }

  // ─── Storage ────────────────────────────────────────────────────────

  private redisKey(userId: string) {
    return `notifications:user:${userId}`;
  }

  private async storeNotification(userId: string, item: NotificationItem): Promise<void> {
    const key = this.redisKey(userId);
    const existing = (await this.redis.getJson<NotificationItem[]>(key)) ?? [];
    existing.unshift(item);
    if (existing.length > NOTIF_MAX) existing.length = NOTIF_MAX;
    await this.redis.setJson(key, existing, NOTIF_TTL);
  }

  async getNotifications(userId: string): Promise<NotificationItem[]> {
    return (await this.redis.getJson<NotificationItem[]>(this.redisKey(userId))) ?? [];
  }

  async dismissNotification(userId: string, notificationId: string): Promise<void> {
    const key = this.redisKey(userId);
    const existing = (await this.redis.getJson<NotificationItem[]>(key)) ?? [];
    const filtered = existing.filter((n) => n.id !== notificationId);
    await this.redis.setJson(key, filtered, NOTIF_TTL);
  }

  // ─── Push helpers ───────────────────────────────────────────────────

  private async sendPush(
    token: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    if (!this.firebaseReady) return;
    try {
      if (token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[')) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: token, sound: 'default', title: payload.title, body: payload.body, data: payload.data ?? {} }),
        });
        return;
      }
      await admin.messaging().send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
    } catch (err) {
      this.logger.error('Push failed', err);
    }
  }

  private async storeAndPushToUser(
    userId: string,
    item: NotificationItem,
    push: { title: string; body: string },
  ): Promise<void> {
    await this.storeNotification(userId, item);
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (u?.fcmToken) {
      await this.sendPush(u.fcmToken, { ...push, data: { type: item.type, matchId: item.matchId ?? '' } });
    }
  }

  private async storeAndPushToMany(
    userIds: string[],
    item: NotificationItem,
    push: { title: string; body: string },
  ): Promise<void> {
    for (const uid of userIds) {
      await this.storeNotification(uid, { ...item, id: randomUUID() });
    }
    if (!this.firebaseReady) return;
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.id IN (:...ids)', { ids: userIds })
      .andWhere('u.fcm_token IS NOT NULL')
      .getMany();
    for (const u of users) {
      if (u.fcmToken) {
        await this.sendPush(u.fcmToken, { ...push, data: { type: item.type, matchId: item.matchId ?? '' } });
      }
    }
  }

  private async getParticipantIds(matchId: string, excludeUserId?: string): Promise<string[]> {
    const rows = await this.participantRepo.find({ where: { matchId } });
    return rows.map((r) => r.userId).filter((id) => id !== excludeUserId);
  }

  private async getParticipantIdsByTeam(matchId: string, teamIndex: number): Promise<string[]> {
    const rows = await this.participantRepo.find({ where: { matchId, teamIndex } });
    return rows.map((r) => r.userId);
  }

  // ─── Existing notifications (updated to also store in Redis) ────────

  async notifyPlayerJoined(match: Match, joiningUserId: string): Promise<void> {
    const joiner = await this.userRepo.findOne({ where: { id: joiningUserId } });
    const username = joiner?.username ?? 'A player';
    await this.storeAndPushToUser(match.creatorId, {
      id: randomUUID(),
      type: 'player_joined',
      matchId: match.id,
      actorUsername: username,
      actorId: joiningUserId,
      extra: { current: String(match.currentPlayers), max: String(match.maxPlayers) },
      createdAt: new Date().toISOString(),
    }, {
      title: 'Someone joined your game!',
      body: `${username} joined your match (${match.currentPlayers}/${match.maxPlayers})`,
    });
  }

  async notifyMatchAlmostFull(match: Match): Promise<void> {
    const spotsLeft = match.maxPlayers - match.currentPlayers;
    const ids = await this.getParticipantIds(match.id);
    if (ids.length === 0) return;
    await this.storeAndPushToMany(ids, {
      id: randomUUID(),
      type: 'match_almost_full',
      matchId: match.id,
      extra: { spots: String(spotsLeft) },
      createdAt: new Date().toISOString(),
    }, {
      title: 'Match almost full!',
      body: `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left!`,
    });
  }

  async notifyInvitedToMatch(matchId: string, invitedUserId: string, inviterUsername: string): Promise<void> {
    await this.storeAndPushToUser(invitedUserId, {
      id: randomUUID(),
      type: 'event_invite',
      matchId,
      actorUsername: inviterUsername,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Event invitation',
      body: `${inviterUsername} invited you to join an event.`,
    });
  }

  async notifyInvitedToRenewedMatch(matchId: string, invitedUserIds: string[], creatorUsername: string): Promise<void> {
    if (invitedUserIds.length === 0) return;
    await this.storeAndPushToMany(invitedUserIds, {
      id: randomUUID(),
      type: 'match_renewed_invite',
      matchId,
      actorUsername: creatorUsername,
      createdAt: new Date().toISOString(),
    }, {
      title: "You're in the new match",
      body: `${creatorUsername} recreated this event.`,
    });
  }

  // ─── New notifications ──────────────────────────────────────────────

  async notifyEventSettingsChanged(match: Match, organizerUsername: string): Promise<void> {
    const ids = await this.getParticipantIds(match.id, match.creatorId);
    if (ids.length === 0) return;
    await this.storeAndPushToMany(ids, {
      id: randomUUID(),
      type: 'event_settings_changed',
      matchId: match.id,
      actorUsername: organizerUsername,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Event updated',
      body: `${organizerUsername} updated the event settings.`,
    });
  }

  async notifyEventStartedEarly(match: Match, organizerUsername: string): Promise<void> {
    const ids = await this.getParticipantIds(match.id, match.creatorId);
    if (ids.length === 0) return;
    await this.storeAndPushToMany(ids, {
      id: randomUUID(),
      type: 'event_started_early',
      matchId: match.id,
      actorUsername: organizerUsername,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Event started!',
      body: `${organizerUsername} started the event early. Go!`,
    });
  }

  async notifyEventDeleted(matchId: string, participantIds: string[], organizerUsername: string): Promise<void> {
    if (participantIds.length === 0) return;
    await this.storeAndPushToMany(participantIds, {
      id: randomUUID(),
      type: 'event_deleted',
      matchId,
      actorUsername: organizerUsername,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Event cancelled',
      body: `${organizerUsername} deleted the event.`,
    });
  }

  async notifyPlayerRemoved(matchId: string, removedUserId: string, organizerUsername: string): Promise<void> {
    await this.storeAndPushToUser(removedUserId, {
      id: randomUUID(),
      type: 'player_removed',
      matchId,
      actorUsername: organizerUsername,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Removed from event',
      body: `${organizerUsername} removed you from the event.`,
    });
  }

  async notifyEventFull(match: Match): Promise<void> {
    const ids = await this.getParticipantIds(match.id);
    if (ids.length === 0) return;
    await this.storeAndPushToMany(ids, {
      id: randomUUID(),
      type: 'event_full',
      matchId: match.id,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Event is full!',
      body: 'All spots are taken.',
    });
  }

  async notifyEventCompleted(match: Match): Promise<void> {
    const flagKey = `completed:notified:${match.id}`;
    const already = await this.redis.get(flagKey);
    if (already) return;
    await this.redis.set(flagKey, '1', 86400);

    const ids = await this.getParticipantIds(match.id);
    if (ids.length === 0) return;
    await this.storeAndPushToMany(ids, {
      id: randomUUID(),
      type: 'event_completed',
      matchId: match.id,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Event finished!',
      body: 'Check the results.',
    });
  }

  async notifyOpponentScoreLocked(
    matchId: string,
    lockingTeamIndex: number,
    opponentTeamIndex: number,
  ): Promise<void> {
    const ids = await this.getParticipantIdsByTeam(matchId, opponentTeamIndex);
    if (ids.length === 0) return;
    await this.storeAndPushToMany(ids, {
      id: randomUUID(),
      type: 'opponent_score_locked',
      matchId,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Opponent locked their score',
      body: 'The other team confirmed their score. Your turn!',
    });
  }

  async notifyScoreOverridden(matchId: string, teamAIndex: number, teamBIndex: number, organizerUsername: string): Promise<void> {
    const idsA = await this.getParticipantIdsByTeam(matchId, teamAIndex);
    const idsB = await this.getParticipantIdsByTeam(matchId, teamBIndex);
    const allIds = [...idsA, ...idsB];
    if (allIds.length === 0) return;
    await this.storeAndPushToMany(allIds, {
      id: randomUUID(),
      type: 'score_overridden',
      matchId,
      actorUsername: organizerUsername,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Score adjusted',
      body: `${organizerUsername} adjusted the score.`,
    });
  }

  async notifyConnectionAccepted(accepterUserId: string, accepterUsername: string, requesterId: string): Promise<void> {
    await this.storeAndPushToUser(requesterId, {
      id: randomUUID(),
      type: 'connection_accepted',
      actorUsername: accepterUsername,
      actorId: accepterUserId,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Connection accepted!',
      body: `${accepterUsername} accepted your connection request.`,
    });
  }

  async notifyPlayerLeftEvent(match: Match, leavingUserId: string, leavingUsername: string): Promise<void> {
    if (match.creatorId === leavingUserId) return;
    await this.storeAndPushToUser(match.creatorId, {
      id: randomUUID(),
      type: 'player_left_event',
      matchId: match.id,
      actorUsername: leavingUsername,
      actorId: leavingUserId,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Player left',
      body: `${leavingUsername} left your event.`,
    });
  }

  async notifyEventReminder30min(match: Match): Promise<void> {
    const ids = await this.getParticipantIds(match.id);
    if (ids.length === 0) return;
    await this.storeAndPushToMany(ids, {
      id: randomUUID(),
      type: 'event_reminder_30min',
      matchId: match.id,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Starting soon!',
      body: 'Your event starts in 30 minutes.',
    });
  }

  async notifyChatMessage(matchId: string, senderUserId: string, senderUsername: string): Promise<void> {
    const ids = await this.getParticipantIds(matchId, senderUserId);
    if (ids.length === 0) return;
    await this.storeAndPushToMany(ids, {
      id: randomUUID(),
      type: 'chat_message',
      matchId,
      actorUsername: senderUsername,
      actorId: senderUserId,
      createdAt: new Date().toISOString(),
    }, {
      title: 'New message',
      body: `${senderUsername} sent a message in the group chat.`,
    });
  }

  async notifyEventCancelledNotEnoughPlayers(match: Match): Promise<void> {
    const ids = await this.getParticipantIds(match.id);
    if (ids.length === 0) return;
    await this.storeAndPushToMany(ids, {
      id: randomUUID(),
      type: 'event_cancelled_not_enough_players',
      matchId: match.id,
      createdAt: new Date().toISOString(),
    }, {
      title: 'Event ended',
      body: 'The event ended because there were not enough players in each team.',
    });
  }
}
