/**
 * Seed: Block/Report testing.
 * Creates 5 test users with chat messages in a match, ready to be blocked/reported.
 *
 * Setup:
 * - Organizer "test" (test@test.com / test1234) auto-created if needed
 * - 5 other users created: TrollGuy, SpamBot, RudePlayer, ChillDude, NicePlayer
 * - One match created with all of them as participants
 * - Each user sends a chat message in the match
 *
 * Use cases to test:
 * 1. Login as test@test.com
 * 2. Open the match → chat → long press a message → Block / Report
 * 3. Open a user profile → ... menu → Block / Report
 * 4. Settings > Blocked users → unblock
 *
 * Run: npx ts-node src/database/seed-block-report.ts
 */

import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { User } from '../modules/users/user.entity';
import { Match, MatchStatus } from '../modules/matches/match.entity';
import { MatchParticipant } from '../modules/matches/match-participant.entity';
import { MatchChatMessage } from '../modules/matches/match-chat-message.entity';
import { TournamentFixtureMatch } from '../modules/matches/tournament-fixture.entity';
import { Court, CourtType } from '../modules/courts/court.entity';

const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://volley:volley_secret@localhost:5432/volleyhub';

const SEED_TAG = '[BLOCKREPORT]';
const SEED_EMAIL_DOMAIN = 'blockreport.volleyhub.local';

const TEST_PLAYERS = [
  {
    username: 'TrollGuy',
    skill: 'beginner',
    position: 'any',
    bio: 'Je trolle pour le fun',
    message: "T'es nul lol",
  },
  {
    username: 'SpamBot',
    skill: 'beginner',
    position: 'any',
    bio: 'Spam spam spam',
    message: 'CHECK MY WEBSITE www.example.com !!! BUY NOW !!!',
  },
  {
    username: 'RudePlayer',
    skill: 'intermediate',
    position: 'libero',
    bio: 'Direct et sans filtre',
    message: 'Vous jouez tous comme des debutants',
  },
  {
    username: 'ChillDude',
    skill: 'intermediate',
    position: 'setter',
    bio: 'Cool, dispo, fair-play',
    message: 'Hate de jouer avec vous tous !',
  },
  {
    username: 'NicePlayer',
    skill: 'advanced',
    position: 'outside_hitter',
    bio: 'Toujours souriant sur le terrain',
    message: 'Bonne chance a tous, on va bien rigoler',
  },
];

const dataSource = new DataSource({
  type: 'postgres',
  url: DB_URL,
  entities: [Court, Match, MatchParticipant, MatchChatMessage, TournamentFixtureMatch, User],
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

  // 1. Find or create the main test user
  const passwordHashOrganizer = await hash('test1234', 12);
  let organizer = await userRepo.findOne({ where: { email: 'test@test.com' } });
  if (!organizer) {
    organizer = userRepo.create({
      username: 'test',
      email: 'test@test.com',
      passwordHash: passwordHashOrganizer,
      skillLevel: 'intermediate' as any,
      position: 'any' as any,
    });
    await userRepo.save(organizer);
    console.log(`Created organizer: ${organizer.username}`);
  } else {
    console.log(`Organizer: ${organizer.username}`);
  }

  // 2. Find or create a court
  let court = await courtRepo.findOne({ where: {} });
  if (!court) {
    const [row] = await dataSource.query(
      `INSERT INTO courts (name, type, location, address, is_registry)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, true)
       RETURNING *`,
      ['Map pin location', CourtType.OUTDOOR, 2.3522, 48.8566, 'Paris, France'],
    );
    court = await courtRepo.findOneOrFail({ where: { id: row.id } });
    console.log('Created default court');
  }

  // 3. Create test players
  const passwordHash = await hash('seed1234', 12);
  const seedUsers: User[] = [];
  for (const p of TEST_PLAYERS) {
    let u = await userRepo.findOne({ where: { username: p.username } });
    if (!u) {
      u = userRepo.create({
        username: p.username,
        email: `${p.username.toLowerCase()}@${SEED_EMAIL_DOMAIN}`,
        passwordHash,
        skillLevel: p.skill as any,
        position: p.position as any,
        bio: p.bio,
      });
      await userRepo.save(u);
      console.log(`  Created ${p.username}`);
    }
    seedUsers.push(u);
  }

  // 4. Create the match
  const match = matchRepo.create({
    courtId: court.id,
    creatorId: organizer.id,
    scheduledAt: new Date(Date.now() + 60 * 60_000), // in 1h
    maxPlayers: 12,
    currentPlayers: 1 + seedUsers.length,
    skillLevel: 'intermediate' as any,
    volleyType: 'classic' as any,
    eventFormat: 'match' as any,
    status: MatchStatus.OPEN,
    matchSets: 3,
    pointsToWin: 25,
    scoringRule: 'point_sec',
    description: `${SEED_TAG} Match for testing block/report features`,
  });
  await matchRepo.save(match);
  console.log(`\nMatch created: ${match.id}`);

  // 5. Add participants (organizer = team 0 slot 0, others spread across teams)
  await participantRepo.insert({
    matchId: match.id,
    userId: organizer.id,
    teamIndex: 0,
    slotIndex: 0,
  });
  for (let i = 0; i < seedUsers.length; i++) {
    const teamIndex = i < 2 ? 0 : 1;
    const slotIndex = i < 2 ? i + 1 : i - 2;
    await participantRepo.insert({
      matchId: match.id,
      userId: seedUsers[i].id,
      teamIndex,
      slotIndex,
    });
  }

  // 6. Each test user sends a chat message
  console.log('\nChat messages:');
  for (let i = 0; i < TEST_PLAYERS.length; i++) {
    const author = seedUsers[i];
    const body = TEST_PLAYERS[i].message;
    const msg = chatRepo.create({
      matchId: match.id,
      userId: author.id,
      body,
    });
    await chatRepo.save(msg);
    console.log(`  ${author.username}: ${body}`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\nHow to test:');
  console.log('1. Login as test@test.com / test1234');
  console.log(`2. Open the match (id ${match.id})`);
  console.log('3. Open the chat → long press a message → Report or Block');
  console.log('4. Tap a username in the participants list → ... menu → Report or Block');
  console.log('5. Settings > Blocked users → unblock');

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
