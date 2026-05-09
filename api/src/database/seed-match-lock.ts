/**
 * Seed: Match lock scenarios.
 * Creates 10 live matches where `test@test.com` is the organizer, each
 * representing one of the team-composition cases handled by the pre-lock modal.
 *
 * Account: test@test.com / test1234
 *
 * For every match the score is pre-filled so the organizer only has to
 * click the final-set save button to trigger the lock flow.
 *
 * Run: npx ts-node src/database/seed-match-lock.ts
 */

import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { User } from '../modules/users/user.entity';
import { Match, MatchStatus } from '../modules/matches/match.entity';
import { MatchParticipant } from '../modules/matches/match-participant.entity';
import { Court, CourtType } from '../modules/courts/court.entity';
import { TournamentFixtureMatch } from '../modules/matches/tournament-fixture.entity';

const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://volley:volley_secret@localhost:5432/volleyhub';

const SEED_TAG = '[LOCK]';
const SEED_EMAIL_DOMAIN = 'lock.volleyhub.local';

const SEED_PLAYERS = [
  { username: 'LockAlice', skill: 'intermediate', position: 'outside_hitter' },
  { username: 'LockBob', skill: 'intermediate', position: 'setter' },
  { username: 'LockCharlie', skill: 'beginner', position: 'libero' },
  { username: 'LockDiane', skill: 'advanced', position: 'middle_blocker' },
  { username: 'LockEmile', skill: 'intermediate', position: 'opposite_hitter' },
  { username: 'LockFiona', skill: 'advanced', position: 'outside_hitter' },
  { username: 'LockGaston', skill: 'intermediate', position: 'setter' },
  { username: 'LockHugo', skill: 'beginner', position: 'libero' },
  { username: 'LockInes', skill: 'advanced', position: 'middle_blocker' },
  { username: 'LockJules', skill: 'intermediate', position: 'opposite_hitter' },
];

interface ScenarioConfig {
  num: number;
  name: string;
  /** Team A players (organizer included if `organizerInA` is true) */
  organizerInA: boolean;
  organizerInB: boolean;
  organizerUnassigned: boolean;
  /** Number of *non-organizer* players in each team */
  otherInA: number;
  otherInB: number;
  /** Number of *non-organizer* unassigned players */
  otherUnassigned: number;
}

const SCENARIOS: ScenarioConfig[] = [
  // 1. A:0 / B:0 / unassigned:1 (creator only) → BLOCKED definitely
  { num: 1, name: 'BLOCKED — creator alone, no one else', organizerInA: false, organizerInB: false, organizerUnassigned: true, otherInA: 0, otherInB: 0, otherUnassigned: 0 },

  // 2. A:1 (creator) / B:0 / unassigned:0 → BLOCKED definitely
  { num: 2, name: 'BLOCKED — only creator in team A, no others', organizerInA: true, organizerInB: false, organizerUnassigned: false, otherInA: 0, otherInB: 0, otherUnassigned: 0 },

  // 3. A:1 (creator) / B:0 / unassigned:2 → modal requires assignment
  { num: 3, name: 'NEEDS ASSIGNMENT — creator in A, B empty, 2 unassigned', organizerInA: true, organizerInB: false, organizerUnassigned: false, otherInA: 0, otherInB: 0, otherUnassigned: 2 },

  // 4. A:0 / B:0 / unassigned:3 (creator + 2) → modal requires assignment
  { num: 4, name: 'NEEDS ASSIGNMENT — everyone unassigned', organizerInA: false, organizerInB: false, organizerUnassigned: true, otherInA: 0, otherInB: 0, otherUnassigned: 2 },

  // 5. A:3 (incl creator) / B:0 / unassigned:0 → LOCK OK + empty-team warning
  { num: 5, name: 'WARN — forfait B (3 in A, B empty)', organizerInA: true, organizerInB: false, organizerUnassigned: false, otherInA: 2, otherInB: 0, otherUnassigned: 0 },

  // 6. A:3 (incl creator) / B:0 / unassigned:2 → LOCK OK + warnings
  { num: 6, name: 'WARN — forfait B + 2 unassigned', organizerInA: true, organizerInB: false, organizerUnassigned: false, otherInA: 2, otherInB: 0, otherUnassigned: 2 },

  // 7. A:1 (creator) / B:1 / unassigned:0 → LOCK direct (1v1)
  { num: 7, name: 'OK — 1v1 (creator vs other)', organizerInA: true, organizerInB: false, organizerUnassigned: false, otherInA: 0, otherInB: 1, otherUnassigned: 0 },

  // 8. A:1 / B:1 / unassigned:2 → LOCK OK + unassigned warning
  { num: 8, name: 'WARN — 1v1 with 2 unassigned', organizerInA: true, organizerInB: false, organizerUnassigned: false, otherInA: 0, otherInB: 1, otherUnassigned: 2 },

  // 9. A:3 / B:3 / unassigned:0 → LOCK direct (3v3 ideal)
  { num: 9, name: 'OK — 3v3 balanced', organizerInA: true, organizerInB: false, organizerUnassigned: false, otherInA: 2, otherInB: 3, otherUnassigned: 0 },

  // 10. A:3 / B:3 / unassigned:2 → LOCK OK + unassigned warning
  { num: 10, name: 'WARN — 3v3 with 2 unassigned', organizerInA: true, organizerInB: false, organizerUnassigned: false, otherInA: 2, otherInB: 3, otherUnassigned: 2 },
];

const dataSource = new DataSource({
  type: 'postgres',
  url: DB_URL,
  entities: [Court, Match, MatchParticipant, User, TournamentFixtureMatch],
  synchronize: false,
});

async function main() {
  await dataSource.initialize();
  console.log('Connected.');

  const userRepo = dataSource.getRepository(User);
  const matchRepo = dataSource.getRepository(Match);
  const participantRepo = dataSource.getRepository(MatchParticipant);
  const courtRepo = dataSource.getRepository(Court);

  // 1. Find or create the test organizer
  const organizerHash = await hash('test1234', 12);
  let organizer = await userRepo.findOne({ where: { email: 'test@test.com' } });
  if (!organizer) {
    organizer = userRepo.create({
      username: 'test',
      email: 'test@test.com',
      passwordHash: organizerHash,
      skillLevel: 'intermediate' as any,
      position: 'any' as any,
    });
    await userRepo.save(organizer);
    console.log('Created organizer test@test.com');
  } else {
    console.log(`Organizer: ${organizer.username}`);
  }

  // 2. Create the seed players
  const playerHash = await hash('seed1234', 12);
  const seedUsers: User[] = [];
  for (const p of SEED_PLAYERS) {
    let u = await userRepo.findOne({ where: { username: p.username } });
    if (!u) {
      u = userRepo.create({
        username: p.username,
        email: `${p.username.toLowerCase()}@${SEED_EMAIL_DOMAIN}`,
        passwordHash: playerHash,
        skillLevel: p.skill as any,
        position: p.position as any,
      });
      await userRepo.save(u);
    }
    seedUsers.push(u);
  }
  console.log(`${seedUsers.length} seed players ready.`);

  // 3. Find or create a Paris court (any court will do, they're all in Paris)
  const PARIS_LAT = 48.8566;
  const PARIS_LNG = 2.3522;
  let court = await courtRepo.findOne({ where: { name: 'Map pin location' } });
  if (!court) {
    const [row] = await dataSource.query(
      `INSERT INTO courts (name, type, location, address, is_registry)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, false)
       RETURNING *`,
      ['Map pin location', CourtType.OUTDOOR, PARIS_LNG, PARIS_LAT, 'Paris, Place de la Republique, Paris, France'],
    );
    court = await courtRepo.findOneOrFail({ where: { id: row.id } });
  }

  // 4. Create one match per scenario
  let cursor = 0;
  /** Pick `n` distinct players from the pool with wrap-around. */
  const pickPlayers = (n: number): User[] => {
    const result: User[] = [];
    for (let i = 0; i < n; i++) {
      result.push(seedUsers[cursor % seedUsers.length]);
      cursor++;
    }
    return result;
  };
  for (const sc of SCENARIOS) {
    const totalNonOrg = sc.otherInA + sc.otherInB + sc.otherUnassigned;
    const players = pickPlayers(totalNonOrg);

    // Match config: 6 max players, 3 sets best-of, 25 points point_sec
    const totalParticipants =
      (sc.organizerInA || sc.organizerInB || sc.organizerUnassigned ? 1 : 0) +
      totalNonOrg;

    const match = matchRepo.create({
      courtId: court.id,
      creatorId: organizer.id,
      scheduledAt: new Date(Date.now() - 30 * 60_000), // started 30 min ago
      maxPlayers: 12,
      currentPlayers: totalParticipants,
      skillLevel: 'intermediate' as any,
      volleyType: 'classic' as any,
      eventFormat: 'match' as any,
      status: MatchStatus.OPEN,
      matchSets: 3,
      pointsToWin: 25,
      scoringRule: 'point_sec',
      // Pre-fill 1 set so organizer can fill the deciding set quickly to trigger lock
      setScores: [{ teamA: 25, teamB: 21 }],
      teamAScore: 1,
      teamBScore: 0,
      description: `${SEED_TAG} #${sc.num} ${sc.name}`,
    });
    await matchRepo.save(match);

    // Insert organizer
    let teamAIdx = 0;
    let teamBIdx = 0;
    if (sc.organizerInA) {
      await participantRepo.insert({
        matchId: match.id,
        userId: organizer.id,
        teamIndex: 0,
        slotIndex: teamAIdx++,
      });
    } else if (sc.organizerInB) {
      await participantRepo.insert({
        matchId: match.id,
        userId: organizer.id,
        teamIndex: 1,
        slotIndex: teamBIdx++,
      });
    } else if (sc.organizerUnassigned) {
      await participantRepo.insert({
        matchId: match.id,
        userId: organizer.id,
        teamIndex: null,
        slotIndex: null,
      });
    }

    // Insert other players
    let p = 0;
    for (let i = 0; i < sc.otherInA; i++) {
      await participantRepo.insert({
        matchId: match.id,
        userId: players[p++].id,
        teamIndex: 0,
        slotIndex: teamAIdx++,
      });
    }
    for (let i = 0; i < sc.otherInB; i++) {
      await participantRepo.insert({
        matchId: match.id,
        userId: players[p++].id,
        teamIndex: 1,
        slotIndex: teamBIdx++,
      });
    }
    for (let i = 0; i < sc.otherUnassigned; i++) {
      await participantRepo.insert({
        matchId: match.id,
        userId: players[p++].id,
        teamIndex: null,
        slotIndex: null,
      });
    }

    console.log(`  #${sc.num} ${sc.name}`);
  }

  console.log('\n✅ Match lock seed complete!');
  console.log('\nLogin: test@test.com / test1234');
  console.log('\nFor each match, navigate to the Score screen, fill the deciding set');
  console.log('(e.g. 25-20 in set 2), and click Save to trigger the lock flow.');
  console.log('\nExpected behaviour per scenario:');
  for (const sc of SCENARIOS) {
    console.log(`  #${sc.num} → ${sc.name}`);
  }

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
