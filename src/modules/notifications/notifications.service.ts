import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { User } from '../users/user.entity';
import { Match } from '../matches/match.entity';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private initialized = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  onModuleInit() {
    const projectId = this.config.get<string>('app.firebase.projectId');
    const privateKey = this.config.get<string>('app.firebase.privateKey');
    const clientEmail = this.config.get<string>('app.firebase.clientEmail');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn('Firebase config missing — push notifications disabled');
      return;
    }

    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey,
            clientEmail,
          }),
        });
      }
      this.initialized = true;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (err) {
      this.logger.warn('Firebase init failed — push notifications disabled: ' + String(err));
    }
  }

  async notifyPlayerJoined(match: Match, joiningUserId: string): Promise<void> {
    if (!this.initialized) return;

    const creator = await this.userRepo.findOne({
      where: { id: match.creatorId },
    });

    if (!creator?.fcmToken || creator.id === joiningUserId) return;

    const joiner = await this.userRepo.findOne({
      where: { id: joiningUserId },
    });

    await this.sendNotification(creator.fcmToken, {
      title: 'Someone joined your game!',
      body: `${joiner?.username ?? 'A player'} joined your match (${match.currentPlayers}/${match.maxPlayers} players)`,
      data: { matchId: match.id, type: 'player_joined' },
    });
  }

  async notifyMatchAlmostFull(match: Match): Promise<void> {
    if (!this.initialized) return;

    const participants = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('match_participants', 'mp', 'mp.user_id = u.id')
      .where('mp.match_id = :matchId', { matchId: match.id })
      .andWhere('u.fcm_token IS NOT NULL')
      .getMany();

    const spotsLeft = match.maxPlayers - match.currentPlayers;

    const tokens = participants
      .map((p) => p.fcmToken)
      .filter((t): t is string => t !== null);

    if (tokens.length === 0) return;

    await this.sendMulticastNotification(tokens, {
      title: 'Match almost full!',
      body: `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left in your match!`,
      data: { matchId: match.id, type: 'match_almost_full' },
    });
  }

  private async sendNotification(
    token: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<void> {
    try {
      // Expo-managed app returns Expo push tokens; route through Expo Push API.
      if (
        token.startsWith('ExpoPushToken[') ||
        token.startsWith('ExponentPushToken[')
      ) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: token,
            sound: 'default',
            title: payload.title,
            body: payload.body,
            data: payload.data ?? {},
          }),
        });
        return;
      }
      await admin.messaging().send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
    } catch (err) {
      this.logger.error('Failed to send FCM notification', err);
    }
  }

  /** Joueurs re-inscrits sur un match « renouvelé » par l’organisateur. */
  async notifyInvitedToRenewedMatch(
    matchId: string,
    invitedUserIds: string[],
    creatorUsername: string,
  ): Promise<void> {
    if (!this.initialized || invitedUserIds.length === 0) {
      return;
    }
    for (const uid of invitedUserIds) {
      const u = await this.userRepo.findOne({ where: { id: uid } });
      if (!u?.fcmToken) {
        continue;
      }
      await this.sendNotification(u.fcmToken, {
        title: 'You’re in the new match',
        body: `${creatorUsername} recreated this event — same place, you’re on the roster.`,
        data: { matchId, type: 'match_renewed_invite' },
      });
    }
  }

  /** Invitation explicite à rejoindre un événement depuis l'écran détail. */
  async notifyInvitedToMatch(
    matchId: string,
    invitedUserId: string,
    inviterUsername: string,
  ): Promise<void> {
    if (!this.initialized) {
      return;
    }
    const u = await this.userRepo.findOne({ where: { id: invitedUserId } });
    if (!u?.fcmToken) {
      return;
    }
    await this.sendNotification(u.fcmToken, {
      title: 'Event invitation',
      body: `${inviterUsername} invited you to join an event.`,
      data: { matchId, type: 'event_invite' },
    });
  }

  private async sendMulticastNotification(
    tokens: string[],
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<void> {
    try {
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
    } catch (err) {
      this.logger.error('Failed to send multicast FCM notification', err);
    }
  }
}
