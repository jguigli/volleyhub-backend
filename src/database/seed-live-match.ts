/**
 * Seed: Creates 2 matches starting NOW with full teams (6v6).
 * Match 1: Point sec (sudden death)
 * Match 2: 2 points d'écart (two-point gap)
 * Jolafrite is the organizer + Team A slot 0 in both.
 *
 * Run: npx ts-node src/database/seed-live-match.ts
 */

import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { User } from '../modules/users/user.entity';
import { Match, MatchStatus } from '../modules/matches/match.entity';
import { MatchParticipant } from '../modules/matches/match-participant.entity';
import { TournamentFixtureMatch } from '../modules/matches/tournament-fixture.entity';
import { Court } from '../modules/courts/court.entity';

const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://volley:volley_secret@localhost:5432/volleyhub';

const SEED_TAG = '[SEED]';
const SEED_EMAIL_DOMAIN = 'seed.volleyhub.local';
const MAX_PLAYERS = 12;
const PLAYERS_PER_TEAM = 6;

const SEED_PLAYERS = [
  { username: 'SeedAlice', skill: 'advanced', position: 'outside_hitter' },
  { username: 'SeedBob', skill: 'intermediate', position: 'setter' },
  { username: 'SeedCharlie', skill: 'beginner', position: 'libero' },
  { username: 'SeedDiane', skill: 'advanced', position: 'middle_blocker' },
  { username: 'SeedEmile', skill: 'intermediate', position: 'opposite_hitter' },
  { username: 'SeedFiona', skill: 'advanced', position: 'outside_hitter' },
  { username: 'SeedGaston', skill: 'intermediate', position: 'setter' },
  { username: 'SeedHugo', skill: 'beginner', position: 'libero' },
  { username: 'SeedInes', skill: 'advanced', position: 'middle_blocker' },
  { username: 'SeedJules', skill: 'intermediate', position: 'opposite_hitter' },
  { username: 'SeedKarine', skill: 'advanced', position: 'any' },
];

const dataSource = new DataSource({
  type: 'postgres',
  url: DB_URL,
  entities: [Court, Match, MatchParticipant, TournamentFixtureMatch, User],
  synchronize: false,
});

async function createFullMatch(
  matchRepo: any,
  participantRepo: any,
  organizer: User,
  seedUsers: User[],
  court: Court,
  label: string,
  scoringRule: 'point_sec' | 'two_point_gap',
) {
  const match = matchRepo.create({
    courtId: court.id,
    creatorId: organizer.id,
    scheduledAt: new Date(),
    maxPlayers: MAX_PLAYERS,
    currentPlayers: MAX_PLAYERS,
    skillLevel: organizer.skillLevel ?? ('intermediate' as any),
    volleyType: 'classic' as any,
    eventFormat: 'match' as any,
    status: MatchStatus.FULL,
    matchSets: 3,
    pointsToWin: 25,
    scoringRule,
    description: `${SEED_TAG} ${label}`,
  });
  await matchRepo.save(match);

  const allPlayers = [organizer, ...seedUsers];
  for (let i = 0; i < allPlayers.length; i++) {
    await participantRepo.insert({
      matchId: match.id,
      userId: allPlayers[i].id,
      teamIndex: i < PLAYERS_PER_TEAM ? 0 : 1,
      slotIndex: i < PLAYERS_PER_TEAM ? i : i - PLAYERS_PER_TEAM,
    });
  }

  return match;
}

async function main() {
  await dataSource.initialize();
  console.log('Connected to database.');

  const userRepo = dataSource.getRepository(User);
  const matchRepo = dataSource.getRepository(Match);
  const participantRepo = dataSource.getRepository(MatchParticipant);
  const courtRepo = dataSource.getRepository(Court);

  const organizer = await userRepo.findOne({ where: { username: 'Jolafrite' } });
  if (!organizer) {
    console.error('User "Jolafrite" not found. Create your account first.');
    process.exit(1);
  }
  console.log(`Organizer: ${organizer.username} (${organizer.id})`);

  const court = await courtRepo.findOne({ where: {} });
  if (!court) {
    console.error('No court found. Create one first.');
    process.exit(1);
  }
  console.log(`Court: ${court.name}`);

  const passwordHash = await hash('seed1234', 12);
  const seedUsers: User[] = [];
  for (const p of SEED_PLAYERS) {
    let u = await userRepo.findOne({ where: { username: p.username } });
    if (!u) {
      u = userRepo.create({
        username: p.username,
        email: `${p.username.toLowerCase()}@${SEED_EMAIL_DOMAIN}`,
        passwordHash,
        skillLevel: p.skill as any,
        position: p.position as any,
      });
      await userRepo.save(u);
      console.log(`  Created ${p.username}`);
    }
    seedUsers.push(u);
  }

  const m1 = await createFullMatch(
    matchRepo, participantRepo, organizer, seedUsers, court,
    'Match Point Sec', 'point_sec',
  );
  console.log(`Match 1 (point sec): ${m1.id}`);

  const m2 = await createFullMatch(
    matchRepo, participantRepo, organizer, seedUsers, court,
    'Match 2pts ecart', 'two_point_gap',
  );
  console.log(`Match 2 (2pts ecart): ${m2.id}`);

  console.log('Done! 2 live matches created.');
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
