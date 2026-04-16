/**
 * Seed: Tournament with 8 teams, 1 empty (team 8).
 * Tests: single forfeit, walkover.
 * Jolafrite is organizer + Team 1 slot 0.
 * Teams 1-7: full (3 players each). Team 8: empty.
 * Starts immediately (scheduledAt = now).
 *
 * Run: npx ts-node src/database/seed-tournament-one-empty.ts
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
const FILLED_TEAMS = 7;

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
  { username: 'SeedPaul', skill: 'advanced', position: 'opposite_hitter' },
  { username: 'SeedQuentin', skill: 'beginner', position: 'any' },
  { username: 'SeedRose', skill: 'advanced', position: 'setter' },
  { username: 'SeedSamuel', skill: 'intermediate', position: 'libero' },
  { username: 'SeedTina', skill: 'beginner', position: 'outside_hitter' },
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
  if (!organizer) { console.error('User "Jolafrite" not found.'); process.exit(1); }
  console.log('Organizer: ' + organizer.username);

  const court = await courtRepo.findOne({ where: {} });
  if (!court) { console.error('No court found.'); process.exit(1); }
  console.log('Court: ' + court.name);

  const passwordHash = await hash('seed1234', 12);
  const seedUsers: User[] = [];
  for (const p of SEED_PLAYERS) {
    let u = await userRepo.findOne({ where: { username: p.username } });
    if (!u) {
      u = userRepo.create({
        username: p.username,
        email: p.username.toLowerCase() + '@' + SEED_EMAIL_DOMAIN,
        passwordHash,
        skillLevel: p.skill as any,
        position: p.position as any,
      });
      await userRepo.save(u);
      console.log('  Created ' + p.username);
    }
    seedUsers.push(u);
  }

  const totalPlayers = 1 + seedUsers.length;
  const match = matchRepo.create({
    courtId: court.id,
    creatorId: organizer.id,
    scheduledAt: new Date(),
    maxPlayers: TEAM_COUNT * TEAM_SIZE,
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
    description: SEED_TAG + ' Tournament 8 teams (1 empty)',
  });
  await matchRepo.save(match);
  console.log('\nTournament created: ' + match.id);

  const allPlayers = [organizer, ...seedUsers];
  const assignments: { player: any; team: number; slot: number }[] = [];
  let playerIdx = 0;
  for (let t = 0; t < FILLED_TEAMS; t++) {
    for (let s = 0; s < TEAM_SIZE; s++) {
      assignments.push({ player: allPlayers[playerIdx], team: t, slot: s });
      playerIdx++;
    }
  }

  for (const a of assignments) {
    await participantRepo.insert({
      matchId: match.id,
      userId: a.player.id,
      teamIndex: a.team,
      slotIndex: a.slot,
    });
  }

  console.log('\nTeams:');
  for (let t = 0; t < TEAM_COUNT; t++) {
    const members = assignments.filter((a) => a.team === t).map((a) => a.player.username);
    if (members.length === 0) {
      console.log('  Team ' + (t + 1) + ': EMPTY (will forfeit)');
    } else {
      console.log('  Team ' + (t + 1) + ': ' + members.join(', '));
    }
  }

  console.log('\nDone! 8 teams (7 full, 1 empty).');
  console.log('Expected: Team 8 auto-forfeits. Team 7 wins QF4 by walkover.');
  await dataSource.destroy();
}

main().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
