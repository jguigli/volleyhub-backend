/**
 * Seed: Apple App Store review.
 * Creates a complete environment for the Apple reviewer to test all features.
 *
 * Account: review@volleyhub.io / ReviewTest2026!
 *
 * Scenarios covered:
 * - Login with demo account
 * - Map exploration (events around Paris)
 * - List view of nearby events
 * - Match details + join flow
 * - Tournament details + bracket launch (as organizer)
 * - Live match with chat messages
 * - Organizer features (manage, kick, mute, edit settings)
 * - Block & report (on troll user with offensive-looking message)
 * - Account deletion (in Settings)
 * - Profile stats (completed matches with wins/losses)
 * - Pending follow requests
 *
 * Run: npx ts-node src/database/seed-apple-review.ts
 */

import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { User } from '../modules/users/user.entity';
import { Match, MatchStatus } from '../modules/matches/match.entity';
import { MatchParticipant } from '../modules/matches/match-participant.entity';
import { MatchChatMessage } from '../modules/matches/match-chat-message.entity';
import { TournamentFixtureMatch } from '../modules/matches/tournament-fixture.entity';
import { Court, CourtType } from '../modules/courts/court.entity';
import { Follow } from '../modules/users/follow.entity';
import { FollowRequest } from '../modules/users/follow-request.entity';

const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://volley:volley_secret@localhost:5432/volleyhub';

const SEED_TAG = '[APPLE]';
const SEED_EMAIL_DOMAIN = 'apple.volleyhub.local';

// ── Realistic players ────────────────────────────────────────────
const PLAYERS = [
  { username: 'Lucas_Martin', skill: 'advanced', position: 'outside_hitter', bio: 'Volleyball enthusiast for 10 years', club: 'Paris Volley Club' },
  { username: 'Emma_Bernard', skill: 'advanced', position: 'setter', bio: 'Captain in National Division 2', club: 'Stade Francais Volley' },
  { username: 'Thomas_Roux', skill: 'intermediate', position: 'middle_blocker', bio: 'Beach addict', club: null },
  { username: 'Chloe_Durand', skill: 'intermediate', position: 'libero', bio: 'Libero at heart', club: 'CVB Puteaux' },
  { username: 'Maxime_Lefevre', skill: 'advanced', position: 'opposite_hitter', bio: 'Ex-pro, now playing for fun', club: 'AS Volley Charenton' },
  { username: 'Camille_Petit', skill: 'beginner', position: 'any', bio: 'Motivated beginner', club: null },
  { username: 'Antoine_Garcia', skill: 'intermediate', position: 'setter', bio: 'Setter in Regional Division 1', club: 'VBC Marcq' },
  { username: 'Sarah_Klein', skill: 'advanced', position: 'outside_hitter', bio: '4v4 beach lover', club: 'Nice Volley Beach' },
  { username: 'Hugo_Vidal', skill: 'intermediate', position: 'middle_blocker', bio: 'Versatile middle blocker', club: 'Lyon Volley' },
  { username: 'Lea_Faure', skill: 'beginner', position: 'libero', bio: 'Switching from handball', club: null },
  { username: 'Nathan_Simon', skill: 'advanced', position: 'opposite_hitter', bio: 'Opposite hitter in National 3', club: 'Montpellier UC' },
  { username: 'Julie_Morel', skill: 'intermediate', position: 'outside_hitter', bio: 'Sunday player', club: null },
  { username: 'Romain_Caron', skill: 'advanced', position: 'setter', bio: 'Setter for 15 years', club: 'Toulouse Spacer' },
  { username: 'Clara_Henry', skill: 'intermediate', position: 'any', bio: 'Beach and indoor', club: 'Bordeaux Volley' },
  { username: 'Theo_Noel', skill: 'beginner', position: 'middle_blocker', bio: 'Tall but new to volleyball', club: null },
  { username: 'Manon_Aubert', skill: 'advanced', position: 'libero', bio: 'Former pro libero', club: 'RC Cannes' },
];

// ── Courts (Paris area + a few in France) ────────────────────────
// Each event gets a unique location to avoid map markers stacking on top of each other.
const COURTS = [
  // Paris (intra-muros, scattered across the city)
  { lat: 48.8584, lng: 2.2945, type: CourtType.OUTDOOR, address: 'Paris, 2 Allee Adrienne Lecouvreur, Paris, France' },
  { lat: 48.8425, lng: 2.2942, type: CourtType.INDOOR, address: 'Paris, 1 Place de la Porte de Versailles, Paris, France' },
  { lat: 48.8538, lng: 2.3751, type: CourtType.INDOOR, address: 'Paris, 2 Rue Japy, Paris, France' },
  { lat: 48.8920, lng: 2.3440, type: CourtType.INDOOR, address: 'Paris, 11 Rue Jean Cocteau, Paris, France' },
  { lat: 48.8439, lng: 2.4340, type: CourtType.OUTDOOR, address: 'Paris, Bois de Vincennes, Paris, France' },
  { lat: 48.8184, lng: 2.3470, type: CourtType.OUTDOOR, address: 'Paris, 17 Avenue Pierre de Coubertin, Paris, France' },
  { lat: 48.8606, lng: 2.3376, type: CourtType.OUTDOOR, address: 'Paris, Jardin des Tuileries, Paris, France' },
  { lat: 48.8611, lng: 2.3711, type: CourtType.INDOOR, address: 'Paris, Centre Sportif Roger Le Gall, Paris, France' },
  { lat: 48.8499, lng: 2.3473, type: CourtType.OUTDOOR, address: 'Paris, Jardin du Luxembourg, Paris, France' },
  { lat: 48.8732, lng: 2.2950, type: CourtType.INDOOR, address: 'Paris, Stade Pierre de Coubertin, Paris, France' },
  { lat: 48.8788, lng: 2.3553, type: CourtType.INDOOR, address: 'Paris, Centre Sportif Bertrand Dauvin, Paris, France' },
  { lat: 48.8867, lng: 2.3431, type: CourtType.OUTDOOR, address: 'Paris, Square de Montholon, Paris, France' },
  { lat: 48.8327, lng: 2.3784, type: CourtType.INDOOR, address: 'Paris, Halle Carpentier, Paris, France' },
  { lat: 48.8722, lng: 2.3091, type: CourtType.OUTDOOR, address: 'Paris, Parc Monceau, Paris, France' },
  // Paris suburbs (close enough to appear on the map)
  { lat: 48.8924, lng: 2.2403, type: CourtType.OUTDOOR, address: 'Boulogne-Billancourt, Parc de Boulogne, Hauts-de-Seine, France' },
  { lat: 48.9047, lng: 2.3076, type: CourtType.INDOOR, address: 'Levallois-Perret, 28 Rue Anatole France, Hauts-de-Seine, France' },
  { lat: 48.8141, lng: 2.4127, type: CourtType.OUTDOOR, address: 'Charenton-le-Pont, Bois de Vincennes Sud, Val-de-Marne, France' },
  { lat: 48.9356, lng: 2.3539, type: CourtType.OUTDOOR, address: 'Saint-Denis, Stade de France Annex, Seine-Saint-Denis, France' },
  { lat: 48.8478, lng: 2.4444, type: CourtType.OUTDOOR, address: 'Montreuil, Parc des Beaumonts, Seine-Saint-Denis, France' },
  // Other French cities (further away — map markers will cluster)
  { lat: 49.3570, lng: 0.0722, type: CourtType.OUTDOOR, address: 'Deauville, Boulevard de la Mer, Calvados, France' },
  { lat: 43.2614, lng: 5.3842, type: CourtType.OUTDOOR, address: 'Marseille, Promenade Georges Pompidou, Bouches-du-Rhone, France' },
  { lat: 43.6947, lng: 7.2662, type: CourtType.OUTDOOR, address: 'Nice, Promenade des Anglais, Alpes-Maritimes, France' },
  { lat: 45.7491, lng: 4.8478, type: CourtType.INDOOR, address: 'Lyon, Halle Tony Garnier, Rhone, France' },
  { lat: 44.8378, lng: -0.5792, type: CourtType.OUTDOOR, address: 'Bordeaux, Plage du Lac, Gironde, France' },
  { lat: 47.2184, lng: -1.5536, type: CourtType.INDOOR, address: 'Nantes, Palais des Sports, Loire-Atlantique, France' },
  { lat: 43.6045, lng: 1.4442, type: CourtType.INDOOR, address: 'Toulouse, Petit Palais des Sports, Haute-Garonne, France' },
];

const dataSource = new DataSource({
  type: 'postgres',
  url: DB_URL,
  entities: [
    Court,
    Match,
    MatchParticipant,
    MatchChatMessage,
    TournamentFixtureMatch,
    User,
    Follow,
    FollowRequest,
  ],
  synchronize: false,
});

async function main() {
  await dataSource.initialize();
  console.log('Connected.');

  const userRepo = dataSource.getRepository(User);
  const matchRepo = dataSource.getRepository(Match);
  const participantRepo = dataSource.getRepository(MatchParticipant);
  const chatRepo = dataSource.getRepository(MatchChatMessage);
  const courtRepo = dataSource.getRepository(Court);
  const followRepo = dataSource.getRepository(Follow);
  const followRequestRepo = dataSource.getRepository(FollowRequest);

  // ── 1. Demo account: AppleReview ───────────────────────────────
  const reviewerHash = await hash('ReviewTest2026!', 12);
  let reviewer = await userRepo.findOne({ where: { email: 'review@volleyhub.io' } });
  if (!reviewer) {
    reviewer = userRepo.create({
      username: 'AppleReview',
      email: 'review@volleyhub.io',
      passwordHash: reviewerHash,
      skillLevel: 'intermediate' as any,
      position: 'outside_hitter' as any,
      bio: 'Test account — explore the app to discover all features.',
      club: 'Demo Volleyball Club',
      league: 'national' as any,
    });
    await userRepo.save(reviewer);
    console.log('Created reviewer account.');
  } else {
    await userRepo.update(reviewer.id, {
      passwordHash: reviewerHash,
      bio: 'Test account — explore the app to discover all features.',
      club: 'Demo Volleyball Club',
      league: 'national' as any,
      skillLevel: 'intermediate' as any,
      position: 'outside_hitter' as any,
    });
    console.log('Reviewer account updated.');
  }

  // ── 2. Seed players ────────────────────────────────────────────
  const playerHash = await hash('seed1234', 12);
  const seedUsers: User[] = [];
  for (const p of PLAYERS) {
    let u = await userRepo.findOne({ where: { username: p.username } });
    if (!u) {
      u = userRepo.create({
        username: p.username,
        email: `${p.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@${SEED_EMAIL_DOMAIN}`,
        passwordHash: playerHash,
        skillLevel: p.skill as any,
        position: p.position as any,
        bio: p.bio,
        club: p.club,
      });
      await userRepo.save(u);
    }
    seedUsers.push(u);
  }
  console.log(`${seedUsers.length} seed players ready.`);

  // ── 3. Courts ──────────────────────────────────────────────────
  const courts: Court[] = [];
  for (const c of COURTS) {
    const [row] = await dataSource.query(
      `INSERT INTO courts (name, type, location, address, is_registry)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, false)
       RETURNING *`,
      ['Map pin location', c.type, c.lng, c.lat, c.address],
    );
    const court = await courtRepo.findOneOrFail({ where: { id: row.id } });
    courts.push(court);
  }
  console.log(`${courts.length} courts created.`);

  // Sequential cursor so each event lands on a unique court (no GPS overlap).
  let courtCursor = 0;
  const nextCourt = (): Court => {
    const c = courts[courtCursor % courts.length];
    courtCursor++;
    return c;
  };

  // Helpers
  let cursor = 0;
  const pickPlayers = (n: number): User[] => {
    const result: User[] = [];
    while (result.length < n) {
      result.push(seedUsers[cursor % seedUsers.length]);
      cursor++;
    }
    return result;
  };
  const assignToTeams = async (
    matchId: string,
    players: User[],
    teamSize: number,
  ) => {
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
  // SCENARIO 1 — LIVE MATCH (reviewer is organizer)
  // → Test: chat moderation, mute panel, organizer score features
  // ══════════════════════════════════════════════════════════════
  const m1Players = [reviewer, ...pickPlayers(5)];
  const m1 = matchRepo.create({
    courtId: nextCourt().id,
    creatorId: reviewer.id,
    scheduledAt: new Date(Date.now() - 10 * 60_000), // started 10 min ago
    maxPlayers: 6,
    currentPlayers: m1Players.length,
    skillLevel: 'intermediate' as any,
    volleyType: 'classic' as any,
    eventFormat: 'match' as any,
    status: MatchStatus.FULL,
    matchSets: 3,
    pointsToWin: 25,
    scoringRule: 'point_sec',
    description: `${SEED_TAG} Live match — you are organizer`,
  });
  await matchRepo.save(m1);
  await assignToTeams(m1.id, m1Players, 3);
  // Chat messages (one is offensive-looking-but-clean to be reportable)
  const chatMessages1 = [
    { user: m1Players[1], body: 'Hi everyone!' },
    { user: m1Players[2], body: "Can't wait to play!" },
    { user: reviewer, body: "We're almost ready." },
    { user: m1Players[3], body: 'Starting in 5 minutes?' },
    { user: m1Players[1], body: 'You all play like beginners 🙄' }, // reportable
    { user: m1Players[4], body: "Let's get on the court!" },
  ];
  for (const msg of chatMessages1) {
    await chatRepo.save(
      chatRepo.create({ matchId: m1.id, userId: msg.user.id, body: msg.body }),
    );
  }
  console.log('  Scenario 1: Live match (reviewer = organizer) ready.');

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 2 — UPCOMING MATCH (reviewer is organizer)
  // → Test: edit settings, invite players, kick from team, manage
  // ══════════════════════════════════════════════════════════════
  const m2Players = [reviewer, ...pickPlayers(3)];
  const m2 = matchRepo.create({
    courtId: nextCourt().id,
    creatorId: reviewer.id,
    scheduledAt: new Date(Date.now() + 90 * 60_000), // in 1.5h
    maxPlayers: 6,
    currentPlayers: m2Players.length,
    skillLevel: 'intermediate' as any,
    volleyType: 'classic' as any,
    eventFormat: 'match' as any,
    status: MatchStatus.OPEN,
    matchSets: 3,
    pointsToWin: 25,
    scoringRule: 'point_sec',
    description: `${SEED_TAG} Upcoming match — you are organizer`,
  });
  await matchRepo.save(m2);
  await assignToTeams(m2.id, m2Players, 3);
  console.log('  Scenario 2: Upcoming match (reviewer = organizer) ready.');

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 3 — UPCOMING MATCH (reviewer joined, NOT organizer)
  // → Test: leave match, change team, see other organizer features
  // ══════════════════════════════════════════════════════════════
  const m3Others = pickPlayers(5);
  const m3 = matchRepo.create({
    courtId: nextCourt().id,
    creatorId: m3Others[0].id,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60_000), // tomorrow
    maxPlayers: 6,
    currentPlayers: 6,
    skillLevel: 'intermediate' as any,
    volleyType: 'classic' as any,
    eventFormat: 'match' as any,
    status: MatchStatus.FULL,
    matchSets: 5,
    pointsToWin: 25,
    scoringRule: 'two_point_gap',
    description: `${SEED_TAG} Upcoming match — you joined as participant`,
  });
  await matchRepo.save(m3);
  await assignToTeams(m3.id, [...m3Others.slice(0, 5), reviewer], 3);
  console.log('  Scenario 3: Upcoming match (reviewer = participant) ready.');

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 4 — UPCOMING MATCH (open, reviewer NOT joined)
  // → Test: join a match
  // ══════════════════════════════════════════════════════════════
  const m4Players = pickPlayers(3);
  const m4 = matchRepo.create({
    courtId: nextCourt().id,
    creatorId: m4Players[0].id,
    scheduledAt: new Date(Date.now() + 60 * 60_000), // in 1h
    maxPlayers: 6,
    currentPlayers: 3,
    skillLevel: 'beginner' as any,
    volleyType: 'green' as any,
    eventFormat: 'match' as any,
    status: MatchStatus.OPEN,
    matchSets: 3,
    pointsToWin: 21,
    scoringRule: 'point_sec',
    description: `${SEED_TAG} Open match — you can join (3 spots left)`,
  });
  await matchRepo.save(m4);
  await assignToTeams(m4.id, m4Players, 3);
  console.log('  Scenario 4: Open match (reviewer can join) ready.');

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 5 — UPCOMING TOURNAMENT (reviewer is organizer)
  // → Test: launch bracket, manage teams, organizer score control
  // ══════════════════════════════════════════════════════════════
  const t1Players = [reviewer, ...pickPlayers(11)]; // 4 teams × 3 = 12
  const t1 = matchRepo.create({
    courtId: nextCourt().id,
    creatorId: reviewer.id,
    scheduledAt: new Date(Date.now() + 30 * 60_000), // in 30min
    maxPlayers: 12,
    currentPlayers: 12,
    skillLevel: 'intermediate' as any,
    volleyType: 'classic' as any,
    eventFormat: 'tournament' as any,
    status: MatchStatus.FULL,
    teamCount: 4,
    teamSize: 3,
    tournamentPointsPerMatch: 25,
    tournamentCourtCount: 2,
    tournamentSystem: 'single_elimination' as any,
    description: `${SEED_TAG} Tournament — you are organizer (4 teams, ready to launch)`,
  });
  await matchRepo.save(t1);
  await assignToTeams(t1.id, t1Players, 3);
  console.log('  Scenario 5: Upcoming tournament (reviewer = organizer) ready.');

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 6 — OPEN TOURNAMENT (reviewer NOT joined)
  // → Test: join tournament, pick a team
  // ══════════════════════════════════════════════════════════════
  const t2Players = pickPlayers(8);
  const t2 = matchRepo.create({
    courtId: nextCourt().id,
    creatorId: t2Players[0].id,
    scheduledAt: new Date(Date.now() + 4 * 60 * 60_000), // in 4h
    maxPlayers: 16,
    currentPlayers: 8,
    skillLevel: 'advanced' as any,
    volleyType: 'classic' as any,
    eventFormat: 'tournament' as any,
    status: MatchStatus.OPEN,
    teamCount: 4,
    teamSize: 4,
    tournamentPointsPerMatch: 21,
    tournamentCourtCount: 2,
    tournamentSystem: 'single_elimination' as any,
    description: `${SEED_TAG} Open tournament — pick your team`,
  });
  await matchRepo.save(t2);
  await assignToTeams(t2.id, t2Players, 4);
  console.log('  Scenario 6: Open tournament (reviewer can join) ready.');

  // ══════════════════════════════════════════════════════════════
  // SCENARIOS 7-10 — Extra map markers (variety)
  // ══════════════════════════════════════════════════════════════
  const extras: Array<{
    volleyType: string;
    maxPlayers: number;
    fillCount: number;
    offset: number;
    skill: string;
    desc: string;
    full: boolean;
  }> = [
    { volleyType: 'beach', maxPlayers: 4, fillCount: 4, offset: -30, skill: 'advanced', desc: 'Live 2v2 beach', full: true },
    { volleyType: 'beach', maxPlayers: 8, fillCount: 5, offset: 24 * 60, skill: 'intermediate', desc: 'Beach tomorrow', full: false },
    { volleyType: 'beach', maxPlayers: 4, fillCount: 4, offset: -15, skill: 'advanced', desc: 'Live 2v2 beach', full: true },
    { volleyType: 'beach', maxPlayers: 8, fillCount: 6, offset: 3 * 60, skill: 'intermediate', desc: 'Beach this afternoon', full: false },
  ];
  for (const e of extras) {
    const players = pickPlayers(e.fillCount);
    const evt = matchRepo.create({
      courtId: nextCourt().id,
      creatorId: players[0].id,
      scheduledAt: new Date(Date.now() + e.offset * 60_000),
      maxPlayers: e.maxPlayers,
      currentPlayers: players.length,
      skillLevel: e.skill as any,
      volleyType: e.volleyType as any,
      eventFormat: 'match' as any,
      status: e.full ? MatchStatus.FULL : MatchStatus.OPEN,
      matchSets: 3,
      pointsToWin: 21,
      scoringRule: 'two_point_gap',
      description: `${SEED_TAG} ${e.desc}`,
    });
    await matchRepo.save(evt);
    await assignToTeams(evt.id, players, e.maxPlayers / 2);
  }
  console.log('  Scenarios 7-10: Extra map markers (beach matches) ready.');

  // ══════════════════════════════════════════════════════════════
  // SCENARIOS 11-14 — Independent events (reviewer not involved)
  // → Test: discovery, browsing list, exploring others' events
  // ══════════════════════════════════════════════════════════════

  // 11. Indoor classic match in 2 days (other organizer, others only)
  const m11Players = pickPlayers(8);
  const m11 = matchRepo.create({
    courtId: nextCourt().id,
    creatorId: m11Players[0].id,
    scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60_000),
    maxPlayers: 12,
    currentPlayers: 8,
    skillLevel: 'advanced' as any,
    volleyType: 'classic' as any,
    eventFormat: 'match' as any,
    status: MatchStatus.OPEN,
    matchSets: 5,
    pointsToWin: 25,
    scoringRule: 'two_point_gap',
    description: `${SEED_TAG} Advanced indoor match — Japy gym (4 spots left)`,
  });
  await matchRepo.save(m11);
  await assignToTeams(m11.id, m11Players, 6);

  // 12. Beginner-friendly green volley match this weekend (other organizer)
  const m12Players = pickPlayers(5);
  const m12 = matchRepo.create({
    courtId: nextCourt().id,
    creatorId: m12Players[0].id,
    scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60_000),
    maxPlayers: 8,
    currentPlayers: 5,
    skillLevel: 'beginner' as any,
    volleyType: 'green' as any,
    eventFormat: 'match' as any,
    status: MatchStatus.OPEN,
    matchSets: 3,
    pointsToWin: 21,
    scoringRule: 'point_sec',
    description: `${SEED_TAG} Beginner green volley — Saturday afternoon`,
  });
  await matchRepo.save(m12);
  await assignToTeams(m12.id, m12Players, 4);

  // 13. Big tournament (16 teams) next week, others organize
  const t3Players = pickPlayers(12);
  const t3 = matchRepo.create({
    courtId: nextCourt().id,
    creatorId: t3Players[0].id,
    scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    maxPlayers: 32,
    currentPlayers: 12,
    skillLevel: 'intermediate' as any,
    volleyType: 'classic' as any,
    eventFormat: 'tournament' as any,
    status: MatchStatus.OPEN,
    teamCount: 8,
    teamSize: 4,
    tournamentPointsPerMatch: 25,
    tournamentCourtCount: 3,
    tournamentSystem: 'single_elimination' as any,
    description: `${SEED_TAG} Big tournament (8 teams) — next Saturday`,
  });
  await matchRepo.save(t3);
  await assignToTeams(t3.id, t3Players, 4);

  // 14. Round-robin tournament (others)
  const t4Players = pickPlayers(8);
  const t4 = matchRepo.create({
    courtId: nextCourt().id,
    creatorId: t4Players[0].id,
    scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60_000),
    maxPlayers: 16,
    currentPlayers: 8,
    skillLevel: 'intermediate' as any,
    volleyType: 'classic' as any,
    eventFormat: 'tournament' as any,
    status: MatchStatus.OPEN,
    teamCount: 4,
    teamSize: 4,
    tournamentPointsPerMatch: 21,
    tournamentCourtCount: 2,
    tournamentSystem: 'round_robin' as any,
    description: `${SEED_TAG} Round-robin tournament — every team plays each other`,
  });
  await matchRepo.save(t4);
  await assignToTeams(t4.id, t4Players, 4);

  console.log('  Scenarios 11-14: Independent events (reviewer not involved) ready.');

  // ══════════════════════════════════════════════════════════════
  // STATS — Completed matches for the reviewer profile
  // ══════════════════════════════════════════════════════════════
  const completedResults = [
    { setScores: [{ teamA: 25, teamB: 20 }, { teamA: 25, teamB: 18 }] },
    { setScores: [{ teamA: 25, teamB: 23 }, { teamA: 22, teamB: 25 }, { teamA: 25, teamB: 19 }] },
    { setScores: [{ teamA: 25, teamB: 17 }, { teamA: 25, teamB: 21 }] },
    { setScores: [{ teamA: 20, teamB: 25 }, { teamA: 18, teamB: 25 }] },
    { setScores: [{ teamA: 25, teamB: 22 }, { teamA: 25, teamB: 20 }] },
    { setScores: [{ teamA: 22, teamB: 25 }, { teamA: 21, teamB: 25 }] },
    { setScores: [{ teamA: 25, teamB: 19 }, { teamA: 25, teamB: 16 }] },
    { setScores: [{ teamA: 25, teamB: 23 }, { teamA: 23, teamB: 25 }, { teamA: 25, teamB: 21 }] },
  ];
  for (let i = 0; i < completedResults.length; i++) {
    const r = completedResults[i];
    const courtIdx = i % courts.length;
    const opponents = pickPlayers(5);
    const daysAgo = (completedResults.length - i) * 4;
    const setsWonA = r.setScores.filter((s) => s.teamA > s.teamB).length;
    const setsWonB = r.setScores.filter((s) => s.teamB > s.teamA).length;
    const cm = matchRepo.create({
      courtId: courts[courtIdx].id,
      creatorId: opponents[0].id,
      scheduledAt: new Date(Date.now() - daysAgo * 24 * 60 * 60_000),
      maxPlayers: 6,
      currentPlayers: 6,
      skillLevel: 'intermediate' as any,
      volleyType: 'classic' as any,
      eventFormat: 'match' as any,
      status: MatchStatus.COMPLETED,
      matchSets: r.setScores.length,
      pointsToWin: 25,
      scoringRule: 'point_sec',
      setScores: r.setScores,
      teamAScore: setsWonA,
      teamBScore: setsWonB,
      description: `${SEED_TAG} Completed match #${i + 1}`,
    });
    await matchRepo.save(cm);
    // Reviewer always on team 0 (winning team for first 6, losing for some)
    await participantRepo.insert({ matchId: cm.id, userId: reviewer.id, teamIndex: 0, slotIndex: 0 });
    for (let j = 0; j < 2; j++) {
      await participantRepo.insert({ matchId: cm.id, userId: opponents[j].id, teamIndex: 0, slotIndex: j + 1 });
    }
    for (let j = 2; j < 5; j++) {
      await participantRepo.insert({ matchId: cm.id, userId: opponents[j].id, teamIndex: 1, slotIndex: j - 2 });
    }
  }
  console.log(`  ${completedResults.length} completed matches (stats) ready.`);

  // ══════════════════════════════════════════════════════════════
  // SOCIAL — Follows + pending follow request
  // ══════════════════════════════════════════════════════════════
  // Reviewer follows 2 users, 2 users follow back (mutual connection)
  for (let i = 0; i < 2; i++) {
    await followRepo.save({ followerId: reviewer.id, followingId: seedUsers[i].id });
    await followRepo.save({ followerId: seedUsers[i].id, followingId: reviewer.id });
  }
  // Reviewer follows another (one-way)
  await followRepo.save({ followerId: reviewer.id, followingId: seedUsers[2].id });
  // Pending request from another user to reviewer
  await followRequestRepo.save({ requesterId: seedUsers[5].id, targetId: reviewer.id });
  // Reviewer has a pending request to another
  await followRequestRepo.save({ requesterId: reviewer.id, targetId: seedUsers[6].id });
  console.log('  Social: 2 mutual connections, 1 follow, 2 pending requests.');

  // ══════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════
  console.log('\n✅ Apple review seed complete!');
  console.log('\nDemo account: review@volleyhub.io / ReviewTest2026!\n');
  console.log('Scenarios ready:');
  console.log('  1. Live match — you are organizer (chat with reportable message)');
  console.log('  2. Upcoming match — you are organizer (test settings, kick, mute)');
  console.log('  3. Upcoming match — you joined as participant');
  console.log('  4. Open match — you can join');
  console.log('  5. Upcoming tournament — you are organizer (launch bracket, manage)');
  console.log('  6. Open tournament — you can join');
  console.log('  7-10. Extra beach matches across France (map markers)');
  console.log('  11-14. Independent events (no involvement, just discovery)');
  console.log('  Stats: 8 completed matches');
  console.log('  Social: 2 connections, 1 follow, 2 pending requests');

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
