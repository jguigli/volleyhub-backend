/**
 * Purge seed-notifications data. Run with: npx ts-node src/database/seed-notifications-purge.ts
 */

import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { User } from '../modules/users/user.entity';
import { Match } from '../modules/matches/match.entity';
import { MatchParticipant } from '../modules/matches/match-participant.entity';
import { TournamentFixtureMatch } from '../modules/matches/tournament-fixture.entity';
import { Court } from '../modules/courts/court.entity';
import { Follow } from '../modules/users/follow.entity';
import { FollowRequest } from '../modules/users/follow-request.entity';

const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://volley:volley_secret@localhost:5432/volleyhub';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

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
  const fixtureRepo = dataSource.getRepository(TournamentFixtureMatch);
  const followRepo = dataSource.getRepository(Follow);
  const followRequestRepo = dataSource.getRepository(FollowRequest);

  const seedBot = await userRepo.findOne({ where: { username: 'SeedBot' } });
  const jolafrite = await userRepo.findOne({ where: { username: 'Jolafrite' } });

  if (seedBot) {
    // Delete matches created by SeedBot
    const matches = await matchRepo.find({ where: { creatorId: seedBot.id } });
    for (const m of matches) {
      await fixtureRepo.delete({ eventMatchId: m.id });
      await participantRepo.delete({ matchId: m.id });
      await matchRepo.delete(m.id);
      console.log(`Deleted match ${m.id}`);
    }

    // Delete follows involving SeedBot
    await followRepo.delete({ followerId: seedBot.id });
    await followRepo.delete({ followingId: seedBot.id });
    await followRequestRepo.delete({ requesterId: seedBot.id });
    await followRequestRepo.delete({ targetId: seedBot.id });

    // Delete SeedBot user
    await userRepo.delete(seedBot.id);
    console.log('Deleted SeedBot user');
  } else {
    console.log('SeedBot not found, skipping DB cleanup');
  }

  // Clear Redis notifications for Jolafrite
  if (jolafrite) {
    await redis.del(`notifications:user:${jolafrite.id}`);
    await redis.del(`invites:user:${jolafrite.id}`);
    console.log('Cleared Redis notifications for Jolafrite');
  }

  console.log('--- Purge complete ---');
  await redis.quit();
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Purge failed:', err);
  process.exit(1);
});
