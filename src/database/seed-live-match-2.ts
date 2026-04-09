/**
 * Seed 2: Creates 30 seed players + 20 events across France.
 * Mix of full/partial matches, various volley types, scoring rules, upcoming/live.
 * Jolafrite is participant in some events.
 *
 * Run: npx ts-node src/database/seed-live-match-2.ts
 */

import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { User } from '../modules/users/user.entity';
import { Match, MatchStatus } from '../modules/matches/match.entity';
import { MatchParticipant } from '../modules/matches/match-participant.entity';
import { TournamentFixtureMatch } from '../modules/matches/tournament-fixture.entity';
import { Court, CourtType } from '../modules/courts/court.entity';

const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://volley:volley_secret@localhost:5432/volleyhub';

const SEED_TAG = '[SEED]';
const SEED_EMAIL_DOMAIN = 'seed.volleyhub.local';

// ── 30 seed players ──────────────────────────────────────────────
const SEED_PLAYERS: { username: string; skill: string; position: string }[] = [];
const FIRST_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diane', 'Emile', 'Fiona', 'Gaston', 'Hugo',
  'Ines', 'Jules', 'Karine', 'Leo', 'Marie', 'Nathan', 'Olivia', 'Paul',
  'Quentin', 'Rose', 'Samuel', 'Tina', 'Ugo', 'Valerie', 'William', 'Xena',
  'Yann', 'Zoe', 'Antoine', 'Brigitte', 'Cedric', 'Delphine',
];
const SKILLS = ['beginner', 'intermediate', 'advanced'];
const POSITIONS = ['setter', 'libero', 'outside_hitter', 'opposite_hitter', 'middle_blocker', 'any'];
for (let i = 0; i < 30; i++) {
  SEED_PLAYERS.push({
    username: `Seed${FIRST_NAMES[i]}`,
    skill: SKILLS[i % 3],
    position: POSITIONS[i % 6],
  });
}

// ── Courts across France ─────────────────────────────────────────
const COURTS: { name: string; lat: number; lng: number; type: CourtType; address: string }[] = [
  { name: `${SEED_TAG} Stade Charléty`, lat: 48.8184, lng: 2.3470, type: CourtType.OUTDOOR, address: 'Paris 13e' },
  { name: `${SEED_TAG} Palais des Sports`, lat: 48.8425, lng: 2.2942, type: CourtType.INDOOR, address: 'Paris 16e' },
  { name: `${SEED_TAG} Plage du Prado`, lat: 43.2614, lng: 5.3842, type: CourtType.OUTDOOR, address: 'Marseille' },
  { name: `${SEED_TAG} Halle Tony Garnier`, lat: 45.7322, lng: 4.8247, type: CourtType.INDOOR, address: 'Lyon' },
  { name: `${SEED_TAG} Plage de la Baule`, lat: 47.2836, lng: -2.3866, type: CourtType.OUTDOOR, address: 'La Baule' },
  { name: `${SEED_TAG} Arena Montpellier`, lat: 43.6032, lng: 3.8823, type: CourtType.INDOOR, address: 'Montpellier' },
  { name: `${SEED_TAG} Plage Biarritz`, lat: 43.4832, lng: -1.5586, type: CourtType.OUTDOOR, address: 'Biarritz' },
  { name: `${SEED_TAG} Gymnase Bordeaux`, lat: 44.8378, lng: -0.5792, type: CourtType.INDOOR, address: 'Bordeaux' },
  { name: `${SEED_TAG} Stade Lille`, lat: 50.6120, lng: 3.1307, type: CourtType.INDOOR, address: 'Lille' },
  { name: `${SEED_TAG} Plage Nice`, lat: 43.6947, lng: 7.2662, type: CourtType.OUTDOOR, address: 'Nice' },
  { name: `${SEED_TAG} Gymnase Nantes`, lat: 47.2184, lng: -1.5536, type: CourtType.INDOOR, address: 'Nantes' },
  { name: `${SEED_TAG} Stade Toulouse`, lat: 43.5833, lng: 1.4340, type: CourtType.OUTDOOR, address: 'Toulouse' },
  { name: `${SEED_TAG} Salle Strasbourg`, lat: 48.5734, lng: 7.7521, type: CourtType.INDOOR, address: 'Strasbourg' },
  { name: `${SEED_TAG} Plage Cannes`, lat: 43.5513, lng: 7.0128, type: CourtType.OUTDOOR, address: 'Cannes' },
  { name: `${SEED_TAG} Arena Rennes`, lat: 48.1173, lng: -1.6778, type: CourtType.INDOOR, address: 'Rennes' },
  { name: `${SEED_TAG} Plage La Rochelle`, lat: 46.1591, lng: -1.1520, type: CourtType.OUTDOOR, address: 'La Rochelle' },
  { name: `${SEED_TAG} Gymnase Grenoble`, lat: 45.1885, lng: 5.7245, type: CourtType.INDOOR, address: 'Grenoble' },
  { name: `${SEED_TAG} Stade Dijon`, lat: 47.3220, lng: 5.0415, type: CourtType.INDOOR, address: 'Dijon' },
  { name: `${SEED_TAG} Plage Arcachon`, lat: 44.6611, lng: -1.1681, type: CourtType.OUTDOOR, address: 'Arcachon' },
  { name: `${SEED_TAG} Arena Clermont`, lat: 45.7772, lng: 3.0870, type: CourtType.INDOOR, address: 'Clermont-Ferrand' },
];

// ── Event definitions ────────────────────────────────────────────
interface EventDef {
  courtIdx: number;
  volleyType: string;
  scoringRule: string;
  maxPlayers: number;
  matchSets: number;
  pointsToWin: number;
  fillCount: number;          // how many players to add (including organizer)
  scheduledOffset: number;    // minutes from now (negative = past = live, positive = upcoming)
  organizerIsJolafrite: boolean;
  description: string;
}

const EVENTS: EventDef[] = [
  // ── Live matches (started, various fill levels) ──
  { courtIdx: 0, volleyType: 'classic', scoringRule: 'point_sec', maxPlayers: 12, matchSets: 5, pointsToWin: 25, fillCount: 12, scheduledOffset: -30, organizerIsJolafrite: true, description: 'Paris live complet' },
  { courtIdx: 2, volleyType: 'beach', scoringRule: 'two_point_gap', maxPlayers: 8, matchSets: 3, pointsToWin: 21, fillCount: 8, scheduledOffset: -15, organizerIsJolafrite: false, description: 'Marseille beach live' },
  { courtIdx: 3, volleyType: 'classic', scoringRule: 'point_sec', maxPlayers: 12, matchSets: 3, pointsToWin: 25, fillCount: 10, scheduledOffset: -45, organizerIsJolafrite: false, description: 'Lyon live pas complet' },
  { courtIdx: 9, volleyType: 'beach', scoringRule: 'two_point_gap', maxPlayers: 4, matchSets: 3, pointsToWin: 21, fillCount: 4, scheduledOffset: -10, organizerIsJolafrite: false, description: 'Nice beach 2v2 live' },
  { courtIdx: 13, volleyType: 'beach', scoringRule: 'point_sec', maxPlayers: 8, matchSets: 3, pointsToWin: 15, fillCount: 6, scheduledOffset: -60, organizerIsJolafrite: false, description: 'Cannes beach live' },

  // ── Upcoming matches (not started, various fill levels) ──
  { courtIdx: 1, volleyType: 'classic', scoringRule: 'two_point_gap', maxPlayers: 12, matchSets: 5, pointsToWin: 25, fillCount: 8, scheduledOffset: 60, organizerIsJolafrite: true, description: 'Paris indoor a venir' },
  { courtIdx: 4, volleyType: 'beach', scoringRule: 'point_sec', maxPlayers: 8, matchSets: 3, pointsToWin: 21, fillCount: 3, scheduledOffset: 120, organizerIsJolafrite: false, description: 'La Baule beach a venir' },
  { courtIdx: 5, volleyType: 'classic', scoringRule: 'point_sec', maxPlayers: 12, matchSets: 3, pointsToWin: 25, fillCount: 12, scheduledOffset: 90, organizerIsJolafrite: false, description: 'Montpellier complet a venir' },
  { courtIdx: 6, volleyType: 'beach', scoringRule: 'two_point_gap', maxPlayers: 4, matchSets: 3, pointsToWin: 21, fillCount: 2, scheduledOffset: 180, organizerIsJolafrite: false, description: 'Biarritz 2v2 a venir' },
  { courtIdx: 7, volleyType: 'classic', scoringRule: 'point_sec', maxPlayers: 12, matchSets: 5, pointsToWin: 25, fillCount: 7, scheduledOffset: 240, organizerIsJolafrite: true, description: 'Bordeaux a venir' },
  { courtIdx: 8, volleyType: 'green', scoringRule: 'point_sec', maxPlayers: 12, matchSets: 3, pointsToWin: 25, fillCount: 4, scheduledOffset: 300, organizerIsJolafrite: false, description: 'Lille green a venir' },
  { courtIdx: 10, volleyType: 'classic', scoringRule: 'two_point_gap', maxPlayers: 12, matchSets: 3, pointsToWin: 25, fillCount: 11, scheduledOffset: 45, organizerIsJolafrite: false, description: 'Nantes presque complet' },
  { courtIdx: 11, volleyType: 'beach', scoringRule: 'point_sec', maxPlayers: 8, matchSets: 3, pointsToWin: 15, fillCount: 5, scheduledOffset: 150, organizerIsJolafrite: false, description: 'Toulouse beach a venir' },
  { courtIdx: 12, volleyType: 'classic', scoringRule: 'point_sec', maxPlayers: 12, matchSets: 5, pointsToWin: 25, fillCount: 6, scheduledOffset: 360, organizerIsJolafrite: false, description: 'Strasbourg a venir' },
  { courtIdx: 14, volleyType: 'green', scoringRule: 'two_point_gap', maxPlayers: 8, matchSets: 3, pointsToWin: 21, fillCount: 8, scheduledOffset: 30, organizerIsJolafrite: true, description: 'Rennes green complet a venir' },
  { courtIdx: 15, volleyType: 'beach', scoringRule: 'point_sec', maxPlayers: 4, matchSets: 3, pointsToWin: 21, fillCount: 3, scheduledOffset: 200, organizerIsJolafrite: false, description: 'La Rochelle 2v2 a venir' },
  { courtIdx: 16, volleyType: 'classic', scoringRule: 'point_sec', maxPlayers: 12, matchSets: 3, pointsToWin: 25, fillCount: 9, scheduledOffset: 480, organizerIsJolafrite: false, description: 'Grenoble a venir' },
  { courtIdx: 17, volleyType: 'classic', scoringRule: 'two_point_gap', maxPlayers: 12, matchSets: 5, pointsToWin: 25, fillCount: 12, scheduledOffset: 600, organizerIsJolafrite: false, description: 'Dijon complet a venir' },
  { courtIdx: 18, volleyType: 'beach', scoringRule: 'two_point_gap', maxPlayers: 8, matchSets: 3, pointsToWin: 21, fillCount: 2, scheduledOffset: 1440, organizerIsJolafrite: false, description: 'Arcachon demain' },
  { courtIdx: 19, volleyType: 'classic', scoringRule: 'point_sec', maxPlayers: 12, matchSets: 3, pointsToWin: 25, fillCount: 10, scheduledOffset: -5, organizerIsJolafrite: false, description: 'Clermont live' },
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
  const jolafrite = await userRepo.findOne({ where: { username: 'Jolafrite' } });
  if (!jolafrite) {
    console.error('User "Jolafrite" not found.');
    process.exit(1);
  }
  console.log(`Organizer: ${jolafrite.username}`);

  // 2. Create seed players
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
    }
    seedUsers.push(u);
  }
  console.log(`${seedUsers.length} seed players ready.`);

  // 3. Create courts
  const courts: Court[] = [];
  for (const c of COURTS) {
    let court = await courtRepo.findOne({ where: { name: c.name } });
    if (!court) {
      const [row] = await dataSource.query(
        `INSERT INTO courts (name, type, location, address, is_registry)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, true)
         RETURNING *`,
        [c.name, c.type, c.lng, c.lat, c.address],
      );
      court = await courtRepo.findOneOrFail({ where: { id: row.id } });
    }
    courts.push(court);
  }
  console.log(`${courts.length} courts ready.`);

  // 4. Create events
  let playerCursor = 0;
  const pickPlayers = (count: number, includeJolafrite: boolean): User[] => {
    const result: User[] = [];
    if (includeJolafrite) result.push(jolafrite);
    const needed = count - result.length;
    for (let i = 0; i < needed; i++) {
      result.push(seedUsers[playerCursor % seedUsers.length]);
      playerCursor++;
    }
    return result;
  };

  for (const ev of EVENTS) {
    const court = courts[ev.courtIdx];
    const scheduledAt = new Date(Date.now() + ev.scheduledOffset * 60_000);
    const players = pickPlayers(ev.fillCount, ev.organizerIsJolafrite);
    const organizer = players[0];
    const isFull = ev.fillCount >= ev.maxPlayers;

    const match = matchRepo.create({
      courtId: court.id,
      creatorId: organizer.id,
      scheduledAt,
      maxPlayers: ev.maxPlayers,
      currentPlayers: players.length,
      skillLevel: organizer.skillLevel ?? ('intermediate' as any),
      volleyType: ev.volleyType as any,
      eventFormat: 'match' as any,
      status: isFull ? MatchStatus.FULL : MatchStatus.OPEN,
      matchSets: ev.matchSets,
      pointsToWin: ev.pointsToWin,
      scoringRule: ev.scoringRule as any,
      description: `${SEED_TAG} ${ev.description}`,
    });
    await matchRepo.save(match);

    const playersPerTeam = Math.floor(ev.maxPlayers / 2);
    for (let i = 0; i < players.length; i++) {
      const teamIndex = i < playersPerTeam ? 0 : 1;
      const slotIndex = i < playersPerTeam ? i : i - playersPerTeam;
      await participantRepo.insert({
        matchId: match.id,
        userId: players[i].id,
        teamIndex,
        slotIndex,
      });
    }

    const status = isFull ? 'FULL' : `${players.length}/${ev.maxPlayers}`;
    const timing = ev.scheduledOffset < 0 ? 'LIVE' : 'UPCOMING';
    console.log(`  [${timing}] ${ev.description} (${status}) @ ${court.name}`);
  }

  console.log(`\nDone! ${EVENTS.length} events created across ${courts.length} locations in France.`);
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
