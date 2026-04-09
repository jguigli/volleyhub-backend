import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Court } from '../modules/courts/court.entity';
import { Match } from '../modules/matches/match.entity';
import { MatchParticipant } from '../modules/matches/match-participant.entity';
import { TournamentFixtureMatch } from '../modules/matches/tournament-fixture.entity';
import { User } from '../modules/users/user.entity';

dotenv.config();

const SEED_TAG = '[SEED_FR]';
const SEED_EMAIL_DOMAIN = 'seed.volleyhub.local';

const dataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgresql://volley:volley_secret@localhost:5432/volleyhub',
  entities: [Court, Match, MatchParticipant, TournamentFixtureMatch, User],
  synchronize: false,
});

async function purgeSeed(): Promise<void> {
  await dataSource.initialize();
  console.log('Database connected. Purging seeded data...');

  await dataSource.query(
    `DELETE FROM match_participants mp
     USING users u
     WHERE mp.user_id = u.id
       AND u.email LIKE $1`,
    [`%@${SEED_EMAIL_DOMAIN}`],
  );

  await dataSource.query(
    `DELETE FROM match_participants mp
     USING matches m
     WHERE mp.match_id = m.id
       AND m.description LIKE $1`,
    [`${SEED_TAG}%`],
  );

  // Also clean up matches created by seed notification scripts
  await dataSource.query(
    `DELETE FROM tournament_fixtures tf
     USING matches m
     WHERE tf.event_match_id = m.id
       AND (m.description LIKE $1 OR m.description LIKE $2)`,
    [`${SEED_TAG}%`, '[SEED]%'],
  );
  await dataSource.query(
    `DELETE FROM match_participants mp
     USING matches m
     WHERE mp.match_id = m.id
       AND m.description LIKE $1`,
    ['[SEED]%'],
  );
  // Delete matches created by seeded users
  await dataSource.query(
    `DELETE FROM tournament_fixtures tf
     USING matches m, users u
     WHERE tf.event_match_id = m.id
       AND m.creator_id = u.id
       AND u.email LIKE $1`,
    [`%@${SEED_EMAIL_DOMAIN}`],
  );
  await dataSource.query(
    `DELETE FROM match_participants mp
     USING matches m, users u
     WHERE mp.match_id = m.id
       AND m.creator_id = u.id
       AND u.email LIKE $1`,
    [`%@${SEED_EMAIL_DOMAIN}`],
  );
  await dataSource.query(
    `DELETE FROM matches WHERE creator_id IN (SELECT id FROM users WHERE email LIKE $1)`,
    [`%@${SEED_EMAIL_DOMAIN}`],
  );

  await dataSource.query(`DELETE FROM matches WHERE description LIKE $1`, [
    `${SEED_TAG}%`,
  ]);
  await dataSource.query(`DELETE FROM matches WHERE description LIKE $1`, [
    '[SEED]%',
  ]);
  // Clean follows/requests involving seeded users
  await dataSource.query(
    `DELETE FROM follows WHERE follower_id IN (SELECT id FROM users WHERE email LIKE $1) OR following_id IN (SELECT id FROM users WHERE email LIKE $1)`,
    [`%@${SEED_EMAIL_DOMAIN}`],
  );
  await dataSource.query(
    `DELETE FROM follow_requests WHERE requester_id IN (SELECT id FROM users WHERE email LIKE $1) OR target_id IN (SELECT id FROM users WHERE email LIKE $1)`,
    [`%@${SEED_EMAIL_DOMAIN}`],
  );
  await dataSource.query(`DELETE FROM courts WHERE name LIKE $1`, [`${SEED_TAG}%`]);
  await dataSource.query(`DELETE FROM users WHERE email LIKE $1`, [
    `%@${SEED_EMAIL_DOMAIN}`,
  ]);

  await dataSource.destroy();
  console.log('Seeded data purged.');
}

purgeSeed().catch((err) => {
  console.error('Seed purge failed:', err);
  process.exit(1);
});
