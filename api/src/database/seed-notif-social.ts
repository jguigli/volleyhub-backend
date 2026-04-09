/**
 * Seed 1: SeedBot sends Jolafrite a follow request, a match invite and a tournament invite.
 * Run: npx ts-node src/database/seed-notif-social.ts
 */

import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { User } from '../modules/users/user.entity';
import { Match, MatchStatus } from '../modules/matches/match.entity';
import { MatchParticipant } from '../modules/matches/match-participant.entity';
import { TournamentFixtureMatch } from '../modules/matches/tournament-fixture.entity';
import { Court } from '../modules/courts/court.entity';
import { Follow } from '../modules/users/follow.entity';
import { FollowRequest } from '../modules/users/follow-request.entity';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://volley:volley_secret@localhost:5432/volleyhub';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const NOTIF_TTL = 60 * 60 * 24 * 30;

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
  const participantRepo = dataSource.getRepository(MatchParticipant);
  const courtRepo = dataSource.getRepository(Court);
  const followRequestRepo = dataSource.getRepository(FollowRequest);

  // Find Jolafrite
  const jolafrite = await userRepo.findOne({ where: { username: 'Jolafrite' } });
  if (!jolafrite) { console.error('User "Jolafrite" not found.'); process.exit(1); }
  console.log(`Jolafrite: ${jolafrite.id}`);

  // Create or find SeedBot
  let seedBot = await userRepo.findOne({ where: { username: 'SeedBot' } });
  if (!seedBot) {
    seedBot = userRepo.create({
      username: 'SeedBot',
      email: 'seedbot@seed.volleyhub.local',
      passwordHash: await hash('seedbot1234', 12),
      skillLevel: 'intermediate' as any,
      position: 'setter' as any,
    });
    await userRepo.save(seedBot);
    console.log('Created SeedBot');
  }

  // Find a court
  const court = await courtRepo.findOne({ where: {} });
  if (!court) { console.error('No court found.'); process.exit(1); }

  // --- 1. Follow request ---
  const existingReq = await followRequestRepo.findOne({
    where: { requesterId: seedBot.id, targetId: jolafrite.id },
  });
  if (!existingReq) {
    await followRequestRepo.save(
      followRequestRepo.create({ requesterId: seedBot.id, targetId: jolafrite.id }),
    );
    console.log('Created follow request SeedBot -> Jolafrite');
  } else {
    console.log('Follow request already exists');
  }

  // --- 2. Match created by SeedBot, invite Jolafrite ---
  const matchEntity = matchRepo.create({
    courtId: court.id,
    creatorId: seedBot.id,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    maxPlayers: 12,
    currentPlayers: 1,
    skillLevel: 'intermediate' as any,
    volleyType: 'classic' as any,
    eventFormat: 'match' as any,
    matchSets: 5,
    pointsToWin: 25,
    status: MatchStatus.OPEN,
    description: '[SEED] Match - invitation test',
  });
  await matchRepo.save(matchEntity);
  await participantRepo.save(
    participantRepo.create({ matchId: matchEntity.id, userId: seedBot.id, teamIndex: 0 }),
  );
  console.log(`Created match: ${matchEntity.id}`);

  // --- 3. Tournament created by SeedBot, invite Jolafrite ---
  const tournamentEntity = matchRepo.create({
    courtId: court.id,
    creatorId: seedBot.id,
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    maxPlayers: 16,
    currentPlayers: 1,
    skillLevel: 'intermediate' as any,
    volleyType: 'classic' as any,
    eventFormat: 'tournament' as any,
    teamCount: 4,
    teamSize: 4,
    tournamentPointsPerMatch: 21,
    tournamentCourtCount: 1,
    tournamentSystem: 'single_elimination' as any,
    status: MatchStatus.OPEN,
    description: '[SEED] Tournoi - invitation test',
  });
  await matchRepo.save(tournamentEntity);
  await participantRepo.save(
    participantRepo.create({ matchId: tournamentEntity.id, userId: seedBot.id, teamIndex: 0 }),
  );
  console.log(`Created tournament: ${tournamentEntity.id}`);

  // --- 4. Store event invites in Redis for Jolafrite ---
  const now = new Date().toISOString();
  const invites = [
    {
      id: randomUUID(),
      matchId: matchEntity.id,
      inviterId: seedBot.id,
      inviterUsername: 'SeedBot',
      eventFormat: 'match',
      title: 'Event invitation',
      body: 'SeedBot invited you to join a match.',
      createdAt: now,
    },
    {
      id: randomUUID(),
      matchId: tournamentEntity.id,
      inviterId: seedBot.id,
      inviterUsername: 'SeedBot',
      eventFormat: 'tournament',
      title: 'Event invitation',
      body: 'SeedBot invited you to join a tournament.',
      createdAt: now,
    },
  ];
  const inviteKey = `invites:user:${jolafrite.id}`;
  const existing = await redis.get(inviteKey);
  const arr = existing ? JSON.parse(existing) : [];
  arr.unshift(...invites);
  await redis.set(inviteKey, JSON.stringify(arr.slice(0, 100)), 'EX', NOTIF_TTL);
  console.log('Stored 2 event invites in Redis');

  console.log('\n--- Seed social complete ---');
  console.log(`Match ID: ${matchEntity.id}`);
  console.log(`Tournament ID: ${tournamentEntity.id}`);

  await redis.quit();
  await dataSource.destroy();
}

main().catch((err) => { console.error(err); process.exit(1); });
