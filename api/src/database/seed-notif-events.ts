/**
 * Seed 2: Push ALL event-related notification types to Jolafrite's Redis inbox.
 * Requires seed-notif-social to have been run first (SeedBot + match + tournament exist).
 * Run: npx ts-node src/database/seed-notif-events.ts
 */

import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { User } from '../modules/users/user.entity';
import { Match } from '../modules/matches/match.entity';
import { MatchParticipant } from '../modules/matches/match-participant.entity';
import { TournamentFixtureMatch } from '../modules/matches/tournament-fixture.entity';
import { Court } from '../modules/courts/court.entity';
import { Follow } from '../modules/users/follow.entity';
import { FollowRequest } from '../modules/users/follow-request.entity';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://volley:volley_secret@localhost:5432/volleyhub';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const NOTIF_TTL = 60 * 60 * 24 * 30;

interface NotificationItem {
  id: string;
  type: string;
  matchId?: string;
  actorUsername?: string;
  actorId?: string;
  extra?: Record<string, string>;
  createdAt: string;
}

const dataSource = new DataSource({
  type: 'postgres',
  url: DB_URL,
  entities: [Court, Match, MatchParticipant, TournamentFixtureMatch, User, Follow, FollowRequest],
  synchronize: false,
});

async function main() {
  await dataSource.initialize();
  const redis = new Redis(REDIS_URL);

  const userRepo = dataSource.getRepository(User);
  const matchRepo = dataSource.getRepository(Match);

  const jolafrite = await userRepo.findOne({ where: { username: 'Jolafrite' } });
  if (!jolafrite) { console.error('User "Jolafrite" not found.'); process.exit(1); }

  const seedBot = await userRepo.findOne({ where: { username: 'SeedBot' } });
  if (!seedBot) { console.error('SeedBot not found. Run seed-notif-social first.'); process.exit(1); }

  // Find SeedBot's matches
  const matches = await matchRepo.find({ where: { creatorId: seedBot.id }, order: { createdAt: 'DESC' } });
  const matchEvent = matches.find((m) => m.eventFormat === 'match');
  const tournamentEvent = matches.find((m) => m.eventFormat === 'tournament');

  if (!matchEvent || !tournamentEvent) {
    console.error('Match or tournament not found. Run seed-notif-social first.');
    process.exit(1);
  }

  const now = new Date();
  const notifications: NotificationItem[] = [
    // --- Organizer actions ---
    {
      id: randomUUID(),
      type: 'event_settings_changed',
      matchId: tournamentEvent.id,
      actorUsername: 'SeedBot',
      actorId: seedBot.id,
      createdAt: new Date(now.getTime() - 15 * 60000).toISOString(),
    },
    {
      id: randomUUID(),
      type: 'event_started_early',
      matchId: tournamentEvent.id,
      actorUsername: 'SeedBot',
      actorId: seedBot.id,
      createdAt: new Date(now.getTime() - 14 * 60000).toISOString(),
    },
    {
      id: randomUUID(),
      type: 'event_deleted',
      matchId: randomUUID(),
      actorUsername: 'SeedBot',
      actorId: seedBot.id,
      createdAt: new Date(now.getTime() - 13 * 60000).toISOString(),
    },
    {
      id: randomUUID(),
      type: 'player_removed',
      matchId: matchEvent.id,
      actorUsername: 'SeedBot',
      actorId: seedBot.id,
      createdAt: new Date(now.getTime() - 12 * 60000).toISOString(),
    },

    // --- Event lifecycle ---
    {
      id: randomUUID(),
      type: 'player_joined',
      matchId: matchEvent.id,
      actorUsername: 'SeedBot',
      actorId: seedBot.id,
      extra: { current: '6', max: '12' },
      createdAt: new Date(now.getTime() - 11 * 60000).toISOString(),
    },
    {
      id: randomUUID(),
      type: 'match_almost_full',
      matchId: matchEvent.id,
      extra: { spots: '2' },
      createdAt: new Date(now.getTime() - 10 * 60000).toISOString(),
    },
    {
      id: randomUUID(),
      type: 'event_full',
      matchId: matchEvent.id,
      createdAt: new Date(now.getTime() - 9 * 60000).toISOString(),
    },
    {
      id: randomUUID(),
      type: 'event_completed',
      matchId: matchEvent.id,
      createdAt: new Date(now.getTime() - 8 * 60000).toISOString(),
    },

    // --- Tournament scores ---
    {
      id: randomUUID(),
      type: 'opponent_score_locked',
      matchId: tournamentEvent.id,
      createdAt: new Date(now.getTime() - 7 * 60000).toISOString(),
    },
    {
      id: randomUUID(),
      type: 'score_overridden',
      matchId: tournamentEvent.id,
      actorUsername: 'SeedBot',
      actorId: seedBot.id,
      createdAt: new Date(now.getTime() - 6 * 60000).toISOString(),
    },

    // --- Social ---
    {
      id: randomUUID(),
      type: 'connection_accepted',
      actorUsername: 'SeedBot',
      actorId: seedBot.id,
      createdAt: new Date(now.getTime() - 5 * 60000).toISOString(),
    },
    {
      id: randomUUID(),
      type: 'player_left_event',
      matchId: matchEvent.id,
      actorUsername: 'SeedBot',
      actorId: seedBot.id,
      createdAt: new Date(now.getTime() - 4 * 60000).toISOString(),
    },

    // --- Invites ---
    {
      id: randomUUID(),
      type: 'event_invite',
      matchId: matchEvent.id,
      actorUsername: 'SeedBot',
      createdAt: new Date(now.getTime() - 3 * 60000).toISOString(),
    },
    {
      id: randomUUID(),
      type: 'match_renewed_invite',
      matchId: matchEvent.id,
      actorUsername: 'SeedBot',
      createdAt: new Date(now.getTime() - 2 * 60000).toISOString(),
    },

    // --- Reminder ---
    {
      id: randomUUID(),
      type: 'event_reminder_30min',
      matchId: matchEvent.id,
      createdAt: new Date(now.getTime() - 1 * 60000).toISOString(),
    },
  ];

  const redisKey = `notifications:user:${jolafrite.id}`;
  const existing = await redis.get(redisKey);
  const existingNotifs: NotificationItem[] = existing ? JSON.parse(existing) : [];
  const merged = [...notifications, ...existingNotifs].slice(0, 200);
  await redis.set(redisKey, JSON.stringify(merged), 'EX', NOTIF_TTL);

  console.log(`Stored ${notifications.length} notifications for Jolafrite:`);
  notifications.forEach((n) => console.log(`  - ${n.type}`));

  console.log('\n--- Seed events complete ---');

  await redis.quit();
  await dataSource.destroy();
}

main().catch((err) => { console.error(err); process.exit(1); });
