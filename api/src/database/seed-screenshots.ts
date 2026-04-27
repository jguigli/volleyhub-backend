/**
 * Seed: App Store screenshot data.
 * Creates realistic players, matches, a live tournament, and completed events
 * so the main user ("Jolafrite") has nice stats and varied data to screenshot.
 *
 * Run: npx ts-node src/database/seed-screenshots.ts
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

const SEED_TAG = '[SCREENSHOT]';
const SEED_EMAIL_DOMAIN = 'screenshot.volleyhub.local';

// ── Realistic players ────────────────────────────────────────────
const PLAYERS = [
  { username: 'Lucas_M', skill: 'advanced', position: 'outside_hitter', bio: 'Passionné de volley depuis 10 ans', club: 'Paris Volley Club' },
  { username: 'Emma_B', skill: 'advanced', position: 'setter', bio: 'Capitaine en N2', club: 'Stade Français Volley' },
  { username: 'Thomas_R', skill: 'intermediate', position: 'middle_blocker', bio: 'Beach addict 🏖️', club: null },
  { username: 'Chloé_D', skill: 'intermediate', position: 'libero', bio: 'Libero de cœur', club: 'CVB Puteaux' },
  { username: 'Maxime_L', skill: 'advanced', position: 'opposite_hitter', bio: 'Ex-pro, maintenant loisir', club: 'AS Volley Charenton' },
  { username: 'Camille_P', skill: 'beginner', position: 'any', bio: 'Débutante motivée !', club: null },
  { username: 'Antoine_G', skill: 'intermediate', position: 'setter', bio: 'Passeur en R1', club: 'VBC Marcq' },
  { username: 'Sarah_K', skill: 'advanced', position: 'outside_hitter', bio: '4x4 beach lover', club: 'Nice Volley Beach' },
  { username: 'Hugo_V', skill: 'intermediate', position: 'middle_blocker', bio: 'Central polyvalent', club: 'Lyon Volley' },
  { username: 'Léa_F', skill: 'beginner', position: 'libero', bio: 'En reconversion du handball', club: null },
  { username: 'Nathan_S', skill: 'advanced', position: 'opposite_hitter', bio: 'Pointu en N3', club: 'Montpellier UC' },
  { username: 'Julie_M', skill: 'intermediate', position: 'outside_hitter', bio: 'Joueuse du dimanche', club: null },
  { username: 'Romain_C', skill: 'advanced', position: 'setter', bio: 'Passeur depuis 15 ans', club: 'Toulouse Spacer' },
  { username: 'Clara_H', skill: 'intermediate', position: 'any', bio: 'Beach & indoor', club: 'Bordeaux Volley' },
  { username: 'Théo_N', skill: 'beginner', position: 'middle_blocker', bio: 'Grand (1m95) mais débutant', club: null },
  { username: 'Manon_A', skill: 'advanced', position: 'libero', bio: 'Libero pro reconvertie', club: 'RC Cannes' },
  { username: 'Quentin_J', skill: 'intermediate', position: 'opposite_hitter', bio: 'Pointu en progression', club: 'Nantes Rezé' },
  { username: 'Inès_W', skill: 'intermediate', position: 'setter', bio: 'Volley + yoga', club: null },
  { username: 'Pierre_T', skill: 'advanced', position: 'outside_hitter', bio: 'Réceptionneur-attaquant N1', club: 'Tours VB' },
  { username: 'Zoé_R', skill: 'beginner', position: 'any', bio: 'Première saison', club: null },
  { username: 'Adrien_B', skill: 'intermediate', position: 'middle_blocker', bio: 'Central en R2', club: 'Poitiers VC' },
  { username: 'Margot_E', skill: 'advanced', position: 'outside_hitter', bio: 'Attaquante expérimentée', club: 'Mulhouse VB' },
  { username: 'Bastien_O', skill: 'intermediate', position: 'setter', bio: 'Passeur loisir', club: null },
  { username: 'Pauline_Z', skill: 'intermediate', position: 'libero', bio: 'Défense avant tout', club: 'Le Cannet RC' },
];

// ── Courts in Paris area + a few in France ───────────────────────
const COURTS = [
  { name: 'Stade Charléty', lat: 48.8184, lng: 2.3470, type: CourtType.OUTDOOR, address: '17 Av. Pierre de Coubertin, Paris 13e' },
  { name: 'Gymnase Japy', lat: 48.8538, lng: 2.3751, type: CourtType.INDOOR, address: '2 Rue Japy, Paris 11e' },
  { name: 'Plage de Deauville', lat: 49.3570, lng: 0.0722, type: CourtType.OUTDOOR, address: 'Boulevard de la Mer, Deauville' },
  { name: 'Palais des Sports', lat: 48.8425, lng: 2.2942, type: CourtType.INDOOR, address: '1 Pl. de la Porte de Versailles, Paris 15e' },
  { name: 'Terrain du Champ de Mars', lat: 48.8560, lng: 2.2977, type: CourtType.OUTDOOR, address: 'Champ de Mars, Paris 7e' },
  { name: 'Gymnase Léo Lagrange', lat: 48.8920, lng: 2.3440, type: CourtType.INDOOR, address: '11 Rue Jean Cocteau, Paris 18e' },
  { name: 'Plage du Prado', lat: 43.2614, lng: 5.3842, type: CourtType.OUTDOOR, address: 'Promenade Georges Pompidou, Marseille' },
  { name: 'Arena Porte de la Chapelle', lat: 48.8976, lng: 2.3595, type: CourtType.INDOOR, address: 'Arena Porte de la Chapelle, Paris 18e' },
  { name: 'Terrain de Vincennes', lat: 48.8439, lng: 2.4340, type: CourtType.OUTDOOR, address: 'Bois de Vincennes, Paris 12e' },
  { name: 'Plage de Nice', lat: 43.6947, lng: 7.2662, type: CourtType.OUTDOOR, address: 'Promenade des Anglais, Nice' },
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

  // ── 1. Create seed players ──────────────────────────────────────
  const passwordHash = await hash('screenshot1234', 12);
  const seedUsers: User[] = [];
  for (const p of PLAYERS) {
    let u = await userRepo.findOne({ where: { username: p.username } });
    if (!u) {
      u = userRepo.create({
        username: p.username,
        email: `${p.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@${SEED_EMAIL_DOMAIN}`,
        passwordHash,
        skillLevel: p.skill as any,
        position: p.position as any,
        bio: p.bio,
        club: p.club,
      });
      await userRepo.save(u);
    }
    seedUsers.push(u);
  }
  console.log(`${seedUsers.length} players created.`);

  // ── 2. Create courts ───────────────────────────────────────────
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
  console.log(`${courts.length} courts created.`);

  // Helper: pick N players from the pool
  let cursor = 0;
  const pick = (n: number): User[] => {
    const result: User[] = [];
    while (result.length < n) {
      result.push(seedUsers[cursor % seedUsers.length]);
      cursor++;
    }
    return result;
  };

  // Helper: assign players to teams for a match
  const assignTeams = async (matchId: string, players: User[], teamSize: number) => {
    for (let i = 0; i < players.length; i++) {
      const teamIndex = Math.floor(i / teamSize);
      const slotIndex = i % teamSize;
      await participantRepo.insert({
        matchId,
        userId: players[i].id,
        teamIndex,
        slotIndex,
      });
    }
  };

  // ══════════════════════════════════════════════════════════════
  // SCREENSHOT 1: MAP — Several events on the map
  // ══════════════════════════════════════════════════════════════

  // Upcoming match near Champ de Mars (me as participant)
  const m1Players = pick(8);
  const m1 = matchRepo.create({
    courtId: courts[4].id, creatorId: m1Players[0].id,
    scheduledAt: new Date(Date.now() + 45 * 60_000),
    maxPlayers: 12, currentPlayers: m1Players.length,
    skillLevel: 'intermediate' as any, volleyType: 'classic' as any,
    eventFormat: 'match' as any, status: MatchStatus.OPEN,
    matchSets: 3, pointsToWin: 25, scoringRule: 'point_sec',
    description: `Volley au Champ de Mars — tous niveaux`,
  });
  await matchRepo.save(m1);
  await assignTeams(m1.id, m1Players, 6);
  console.log('  MAP: Champ de Mars match (8/12)');

  // Live beach match at Vincennes
  const m2Players = pick(4);
  const m2 = matchRepo.create({
    courtId: courts[8].id, creatorId: m2Players[0].id,
    scheduledAt: new Date(Date.now() - 20 * 60_000),
    maxPlayers: 4, currentPlayers: 4,
    skillLevel: 'advanced' as any, volleyType: 'beach' as any,
    eventFormat: 'match' as any, status: MatchStatus.FULL,
    matchSets: 3, pointsToWin: 21, scoringRule: 'two_point_gap',
    description: `Beach 2v2 Vincennes`,
  });
  await matchRepo.save(m2);
  await assignTeams(m2.id, m2Players, 2);
  console.log('  MAP: Vincennes beach 2v2 (FULL/LIVE)');

  // Indoor at Gymnase Japy (almost full)
  const m3Players = pick(10);
  const m3 = matchRepo.create({
    courtId: courts[1].id, creatorId: m3Players[0].id,
    scheduledAt: new Date(Date.now() + 90 * 60_000),
    maxPlayers: 12, currentPlayers: 10,
    skillLevel: 'intermediate' as any, volleyType: 'classic' as any,
    eventFormat: 'match' as any, status: MatchStatus.OPEN,
    matchSets: 5, pointsToWin: 25, scoringRule: 'two_point_gap',
    description: `Indoor Japy — 2 places restantes !`,
  });
  await matchRepo.save(m3);
  await assignTeams(m3.id, m3Players, 6);
  console.log('  MAP: Japy indoor (10/12)');

  // Arena Porte de la Chapelle (full, upcoming)
  const m4Players = pick(12);
  const m4 = matchRepo.create({
    courtId: courts[7].id, creatorId: m4Players[0].id,
    scheduledAt: new Date(Date.now() + 180 * 60_000),
    maxPlayers: 12, currentPlayers: 12,
    skillLevel: 'advanced' as any, volleyType: 'classic' as any,
    eventFormat: 'match' as any, status: MatchStatus.FULL,
    matchSets: 5, pointsToWin: 25, scoringRule: 'point_sec',
    description: `Match N3 — Arena Chapelle`,
  });
  await matchRepo.save(m4);
  await assignTeams(m4.id, m4Players, 6);
  console.log('  MAP: Arena Chapelle (FULL)');

  // Léo Lagrange (few players, me joined)
  const m5Players = pick(5);
  const m5 = matchRepo.create({
    courtId: courts[5].id, creatorId: m5Players[0].id,
    scheduledAt: new Date(Date.now() + 60 * 60_000),
    maxPlayers: 8, currentPlayers: 5,
    skillLevel: 'beginner' as any, volleyType: 'green' as any,
    eventFormat: 'match' as any, status: MatchStatus.OPEN,
    matchSets: 3, pointsToWin: 15, scoringRule: 'point_sec',
    description: `Green volley débutants — Léo Lagrange`,
  });
  await matchRepo.save(m5);
  await assignTeams(m5.id, m5Players, 4);
  console.log('  MAP: Léo Lagrange green (5/8)');

  // Marseille beach
  const m6Players = pick(6);
  const m6 = matchRepo.create({
    courtId: courts[6].id, creatorId: m6Players[0].id,
    scheduledAt: new Date(Date.now() + 120 * 60_000),
    maxPlayers: 8, currentPlayers: 6,
    skillLevel: 'intermediate' as any, volleyType: 'beach' as any,
    eventFormat: 'match' as any, status: MatchStatus.OPEN,
    matchSets: 3, pointsToWin: 21, scoringRule: 'two_point_gap',
    description: `Beach 4v4 Prado`,
  });
  await matchRepo.save(m6);
  await assignTeams(m6.id, m6Players, 4);
  console.log('  MAP: Marseille beach (6/8)');

  // Nice beach
  const m7Players = pick(4);
  const m7 = matchRepo.create({
    courtId: courts[9].id, creatorId: m7Players[0].id,
    scheduledAt: new Date(Date.now() - 10 * 60_000),
    maxPlayers: 4, currentPlayers: 4,
    skillLevel: 'advanced' as any, volleyType: 'beach' as any,
    eventFormat: 'match' as any, status: MatchStatus.FULL,
    matchSets: 3, pointsToWin: 21, scoringRule: 'point_sec',
    description: `Beach 2v2 Nice`,
  });
  await matchRepo.save(m7);
  await assignTeams(m7.id, m7Players, 2);
  console.log('  MAP: Nice beach (FULL/LIVE)');

  // ══════════════════════════════════════════════════════════════
  // SCREENSHOT 2: MATCH DETAIL — A nice match I organized
  // (m1 above: Champ de Mars, 8/12 players, me organizer)
  // ══════════════════════════════════════════════════════════════
  console.log('  DETAIL: Use Champ de Mars match (m1)');

  // ══════════════════════════════════════════════════════════════
  // SCREENSHOT 3: TOURNAMENT — 8 teams, single elimination, live
  // ══════════════════════════════════════════════════════════════
  const tournamentPlayers = pick(24); // me + 23 others = 8 teams of 3
  const tournament = matchRepo.create({
    courtId: courts[3].id, creatorId: tournamentPlayers[0].id,
    scheduledAt: new Date(Date.now() - 60 * 60_000),
    maxPlayers: 24, currentPlayers: 24,
    skillLevel: 'intermediate' as any, volleyType: 'classic' as any,
    eventFormat: 'tournament' as any, status: MatchStatus.FULL,
    teamCount: 8, teamSize: 3,
    tournamentPointsPerMatch: 25, tournamentCourtCount: 2,
    tournamentSystem: 'single_elimination' as any,
    description: `Tournoi Palais des Sports — 8 équipes`,
  });
  await matchRepo.save(tournament);
  await assignTeams(tournament.id, tournamentPlayers, 3);
  console.log('  TOURNAMENT: Palais des Sports (8 teams, live)');

  // ══════════════════════════════════════════════════════════════
  // SCREENSHOT 4: TEAMS — (use m1 Champ de Mars or the tournament)
  // ══════════════════════════════════════════════════════════════
  console.log('  TEAMS: Use Champ de Mars match or tournament');

  // ══════════════════════════════════════════════════════════════
  // SCREENSHOT 5: PROFILE & STATS — Completed matches for Jolafrite
  // ══════════════════════════════════════════════════════════════

  // Create 12 completed matches with realistic scores
  const completedResults = [
    { setScores: [{ teamA: 25, teamB: 20 }, { teamA: 25, teamB: 18 }, { teamA: 25, teamB: 22 }] },
    { setScores: [{ teamA: 25, teamB: 23 }, { teamA: 22, teamB: 25 }, { teamA: 25, teamB: 19 }] },
    { setScores: [{ teamA: 25, teamB: 17 }, { teamA: 25, teamB: 21 }] },
    { setScores: [{ teamA: 25, teamB: 22 }, { teamA: 25, teamB: 20 }] },
    { setScores: [{ teamA: 25, teamB: 19 }, { teamA: 25, teamB: 16 }] },
    { setScores: [{ teamA: 21, teamB: 25 }, { teamA: 25, teamB: 23 }, { teamA: 25, teamB: 20 }] },
    { setScores: [{ teamA: 25, teamB: 14 }, { teamA: 25, teamB: 18 }] },
    { setScores: [{ teamA: 25, teamB: 23 }, { teamA: 23, teamB: 25 }, { teamA: 25, teamB: 21 }] },
    { setScores: [{ teamA: 25, teamB: 20 }, { teamA: 25, teamB: 22 }] },
    { setScores: [{ teamA: 20, teamB: 25 }, { teamA: 18, teamB: 25 }] },
    { setScores: [{ teamA: 25, teamB: 23 }, { teamA: 19, teamB: 25 }, { teamA: 20, teamB: 25 }] },
    { setScores: [{ teamA: 22, teamB: 25 }, { teamA: 21, teamB: 25 }] },
  ];

  for (let i = 0; i < completedResults.length; i++) {
    const r = completedResults[i];
    const courtIdx = i % courts.length;
    const players = pick(6);
    const daysAgo = (completedResults.length - i) * 3;

    const setsWonA = r.setScores.filter(s => s.teamA > s.teamB).length;
    const setsWonB = r.setScores.filter(s => s.teamB > s.teamA).length;

    const cm = matchRepo.create({
      courtId: courts[courtIdx].id, creatorId: players[0].id,
      scheduledAt: new Date(Date.now() - daysAgo * 24 * 60 * 60_000),
      maxPlayers: 6, currentPlayers: 6,
      skillLevel: 'intermediate' as any, volleyType: i % 3 === 0 ? 'beach' as any : 'classic' as any,
      eventFormat: 'match' as any, status: MatchStatus.COMPLETED,
      matchSets: r.setScores.length, pointsToWin: 25, scoringRule: 'point_sec',
      setScores: r.setScores,
      teamAScore: setsWonA, teamBScore: setsWonB,
      description: `Match terminé #${i + 1}`,
    });
    await matchRepo.save(cm);

    for (let j = 0; j < 3; j++) {
      await participantRepo.insert({ matchId: cm.id, userId: players[j].id, teamIndex: 0, slotIndex: j });
    }
    for (let j = 3; j < 6; j++) {
      await participantRepo.insert({ matchId: cm.id, userId: players[j].id, teamIndex: 1, slotIndex: j - 3 });
    }
  }
  console.log('  STATS: 12 completed matches');

  // ── Deauville beach upcoming (extra map marker)
  const m8Players = pick(3);
  const m8 = matchRepo.create({
    courtId: courts[2].id, creatorId: m8Players[0].id,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60_000), // tomorrow
    maxPlayers: 8, currentPlayers: 3,
    skillLevel: 'intermediate' as any, volleyType: 'beach' as any,
    eventFormat: 'match' as any, status: MatchStatus.OPEN,
    matchSets: 3, pointsToWin: 21, scoringRule: 'two_point_gap',
    description: `Beach à Deauville — demain`,
  });
  await matchRepo.save(m8);
  await assignTeams(m8.id, m8Players, 4);
  console.log('  MAP: Deauville beach (3/8, tomorrow)');

  console.log('\n✅ Screenshot seed complete!');
  console.log('\nScreenshot guide:');
  console.log('  1. MAP       → Open map centered on Paris, multiple markers visible');
  console.log('  2. DETAIL    → Tap "Champ de Mars" match (8/12 players, you organizer)');
  console.log('  3. TOURNAMENT → Open "Palais des Sports" tournament, launch bracket');
  console.log('  4. TEAMS     → Open team board from Champ de Mars or tournament');
  console.log('  5. PROFILE   → Open your profile → 12 matches, 9W/3L, 75% win rate');

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
