/**
 * Seed: Creates a tournament starting in 5 minutes with full teams.
 * Jolafrite is the organizer + Team 1 slot 0.
 * 4 teams of 4 players = 16 players total.
 * System: single elimination, 2 courts.
 *
 * Run: npx ts-node src/database/seed-tournament.ts
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

const TEAM_COUNT = 4;
const TEAM_SIZE = 4;
const MAX_PLAYERS = TEAM_COUNT * TEAM_SIZE; // 16
// Set to 0 for immediate start, or 5 to test the "upcoming → live" transition
const START_IN_MINUTES = 0;

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
  { username: 'SeedLeo', skill: 'intermediate', position: 'setter' },
  { username: 'SeedMarie', skill: 'beginner', position: 'libero' },
  { username: 'SeedNathan', skill: 'advanced', position: 'outside_hitter' },
  { username: 'SeedOlivia', skill: 'intermediate', position: 'middle_blocker' },
];

const dataSource = new DataSource({
  type: 'postgres',
  url: DB_URL,
  entities: [Court, Match, MatchParticipant, TournamentFixtureMatch, User],
  synchronize: false,
});

async function main() {
  await dataSource.initialize();
  console.log('Connected.');

  const userRepo = dataSource.getRepository(User);
  const matchRepo = dataSource.getRepository(Match);
  const participantRepo = dataSource.getRepository(MatchParticipant);
  const courtRepo = dataSource.getRepository(Court);

  // 1. Find Jolafrite
  const organizer = await userRepo.findOne({ where: { username: 'Jolafrite' } });
  if (!organizer) {
    console.error('User "Jolafrite" not found.');
    process.exit(1);
  }
  console.log(`Organizer: ${organizer.username}`);

  // 2. Find a court
  const court = await courtRepo.findOne({ where: {} });
  if (!court) {
    console.error('No court found.');
    process.exit(1);
  }
  console.log(`Court: ${court.name}`);

  // 3. Create or find seed players (need 15 to fill teams with Jolafrite)
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

  // 4. Create tournament — starts in 5 minutes
  const scheduledAt = new Date(Date.now() + START_IN_MINUTES * 60_000);
  const match = matchRepo.create({
    courtId: court.id,
    creatorId: organizer.id,
    scheduledAt,
    maxPlayers: MAX_PLAYERS,
    currentPlayers: MAX_PLAYERS,
    skillLevel: organizer.skillLevel ?? ('intermediate' as any),
    volleyType: 'classic' as any,
    eventFormat: 'tournament' as any,
    status: MatchStatus.FULL,
    teamCount: TEAM_COUNT,
    teamSize: TEAM_SIZE,
    tournamentPointsPerMatch: 25,
    tournamentCourtCount: 2,
    tournamentSystem: 'single_elimination' as any,
    description: `${SEED_TAG} Tournament seeded`,
  });
  await matchRepo.save(match);
  console.log(`Tournament created: ${match.id}`);
  console.log(`Starts at: ${scheduledAt.toLocaleTimeString()} (in ${START_IN_MINUTES} min)`);

  // 5. Add participants with teams
  // Jolafrite = Team 0 slot 0, then seed players fill the rest
  const allPlayers = [organizer, ...seedUsers]; // 16 total

  for (let i = 0; i < allPlayers.length; i++) {
    const teamIndex = Math.floor(i / TEAM_SIZE);
    const slotIndex = i % TEAM_SIZE;

    await participantRepo.insert({
      matchId: match.id,
      userId: allPlayers[i].id,
      teamIndex,
      slotIndex,
    });
  }

  console.log(`\nTeams:`);
  for (let t = 0; t < TEAM_COUNT; t++) {
    const start = t * TEAM_SIZE;
    const members = allPlayers.slice(start, start + TEAM_SIZE).map((u) => u.username);
    console.log(`  Team ${t + 1}: ${members.join(', ')}`);
  }

  console.log(`\nDone! Tournament with ${TEAM_COUNT} teams x ${TEAM_SIZE} players.`);
  console.log(`It will go live in ${START_IN_MINUTES} minutes.`);

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
