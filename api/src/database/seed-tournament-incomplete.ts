/**
 * Seed: Tournament with 8 teams, 2 of which are empty (teams 7 & 8).
 * Tests: double forfeit, walkover propagation, incomplete team warning.
 * Jolafrite is organizer + Team 1 slot 0.
 * Teams 1-6: full (3 players each). Teams 7 & 8: empty.
 * Starts immediately (scheduledAt = now).
 *
 * Run: npx ts-node src/database/seed-tournament-incomplete.ts
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

const TEAM_COUNT = 8;
const TEAM_SIZE = 3;
const FILLED_TEAMS = 6; // teams 0-5 are full, teams 6-7 are empty

const SEED_PLAYERS = [
  // Team 1 (index 0): Jolafrite + 2
  { username: 'SeedAlice', skill: 'advanced', position: 'outside_hitter' },
  { username: 'SeedBob', skill: 'intermediate', position: 'setter' },
  // Team 2 (index 1)
  { username: 'SeedCharlie', skill: 'beginner', position: 'libero' },
  { username: 'SeedDiane', skill: 'advanced', position: 'middle_blocker' },
  { username: 'SeedEmile', skill: 'intermediate', position: 'opposite_hitter' },
  // Team 3 (index 2)
  { username: 'SeedFiona', skill: 'advanced', position: 'outside_hitter' },
  { username: 'SeedGaston', skill: 'intermediate', position: 'setter' },
  { username: 'SeedHugo', skill: 'beginner', position: 'libero' },
  // Team 4 (index 3)
  { username: 'SeedInes', skill: 'advanced', position: 'middle_blocker' },
  { username: 'SeedJules', skill: 'intermediate', position: 'opposite_hitter' },
  { username: 'SeedKarine', skill: 'advanced', position: 'any' },
  // Team 5 (index 4)
  { username: 'SeedLeo', skill: 'intermediate', position: 'setter' },
  { username: 'SeedMarie', skill: 'beginner', position: 'libero' },
  { username: 'SeedNathan', skill: 'advanced', position: 'outside_hitter' },
  // Team 6 (index 5)
  { username: 'SeedOlivia', skill: 'intermediate', position: 'middle_blocker' },
  { username: 'SeedPaul', skill: 'advanced', position: 'opposite_hitter' },
  { username: 'SeedQuentin', skill: 'beginner', position: 'any' },
  // Teams 7 & 8 (index 6 & 7): EMPTY
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

  const organizer = await userRepo.findOne({ where: { username: 'Jolafrite' } });
  if (!organizer) {
    console.error('User "Jolafrite" not found.');
    process.exit(1);
  }
  console.log(`Organizer: ${organizer.username}`);

  const court = await courtRepo.findOne({ where: {} });
  if (!court) {
    console.error('No court found.');
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

  const totalPlayers = 1 + seedUsers.length; // 19
  const match = matchRepo.create({
    courtId: court.id,
    creatorId: organizer.id,
    scheduledAt: new Date(),
    maxPlayers: TEAM_COUNT * TEAM_SIZE, // 24
    currentPlayers: totalPlayers,
    skillLevel: organizer.skillLevel ?? ('intermediate' as any),
    volleyType: 'classic' as any,
    eventFormat: 'tournament' as any,
    status: MatchStatus.OPEN,
    teamCount: TEAM_COUNT,
    teamSize: TEAM_SIZE,
    tournamentPointsPerMatch: 25,
    tournamentCourtCount: 2,
    tournamentSystem: 'single_elimination' as any,
    description: `${SEED_TAG} Tournament 8 teams (2 empty)`,
  });
  await matchRepo.save(match);
  console.log(`\nTournament created: ${match.id}`);

  const allPlayers = [organizer, ...seedUsers];
  const assignments: { player: any; team: number; slot: number }[] = [];

  // Teams 0-5: 3 players each
  let playerIdx = 0;
  for (let t = 0; t < FILLED_TEAMS; t++) {
    for (let s = 0; s < TEAM_SIZE; s++) {
      assignments.push({ player: allPlayers[playerIdx], team: t, slot: s });
      playerIdx++;
    }
  }
  // Teams 6 & 7: EMPTY

  for (const a of assignments) {
    await participantRepo.insert({
      matchId: match.id,
      userId: a.player.id,
      teamIndex: a.team,
      slotIndex: a.slot,
    });
  }

  console.log(`\nTeams:`);
  for (let t = 0; t < TEAM_COUNT; t++) {
    const members = assignments.filter((a) => a.team === t).map((a) => a.player.username);
    if (members.length === 0) {
      console.log(`  Team ${t + 1}: EMPTY (will forfeit)`);
    } else {
      console.log(`  Team ${t + 1}: ${members.join(', ')}`);
    }
  }

  console.log(`\nDone! Tournament with ${TEAM_COUNT} teams (${FILLED_TEAMS} full, ${TEAM_COUNT - FILLED_TEAMS} empty).`);
  console.log('Open "Match en direct" and click "Lancer le tournoi".');
  console.log('Expected bracket (single elimination, 8 teams):');
  console.log('  QF1: Team 1 vs Team 2');
  console.log('  QF2: Team 3 vs Team 4');
  console.log('  QF3: Team 5 vs Team 6');
  console.log('  QF4: Team 7 vs Team 8 → double forfeit (0-0)');
  console.log('  SF1: Winner QF1 vs Winner QF2');
  console.log('  SF2: Winner QF3 vs walkover (no winner from QF4)');
  console.log('  Final: Winner SF1 vs Winner SF2');

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
