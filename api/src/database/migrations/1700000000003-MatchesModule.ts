import { MigrationInterface, QueryRunner } from 'typeorm';

export class MatchesModule1700000000003 implements MigrationInterface {
  name = 'MatchesModule1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums for matches
    await queryRunner.query(`
      CREATE TYPE "public"."matches_skill_level_enum" AS ENUM ('beginner', 'intermediate', 'advanced')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."matches_volley_type_enum" AS ENUM ('classic', 'beach', 'green')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."matches_event_format_enum" AS ENUM ('match', 'tournament')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."matches_status_enum" AS ENUM ('open', 'full', 'cancelled', 'completed')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."tournament_system_enum" AS ENUM ('single_elimination', 'pools_finals', 'round_robin')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."tournament_fixture_status_enum" AS ENUM ('pending', 'ready', 'live', 'finished')
    `);

    // Table: matches
    await queryRunner.query(`
      CREATE TABLE "matches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "court_id" uuid NOT NULL,
        "creator_id" uuid NOT NULL,
        "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "max_players" integer NOT NULL DEFAULT 12,
        "current_players" integer NOT NULL DEFAULT 0,
        "skill_level" "public"."matches_skill_level_enum" NOT NULL DEFAULT 'beginner',
        "volley_type" "public"."matches_volley_type_enum" NOT NULL DEFAULT 'classic',
        "event_format" "public"."matches_event_format_enum" NOT NULL DEFAULT 'match',
        "team_count" integer,
        "team_size" integer,
        "match_sets" integer,
        "points_to_win" integer,
        "scoring_rule" character varying DEFAULT 'point_sec',
        "tournament_points_per_match" integer,
        "tournament_court_count" integer,
        "tournament_system" "public"."tournament_system_enum",
        "status" "public"."matches_status_enum" NOT NULL DEFAULT 'open',
        "description" character varying,
        "team_a_score" integer,
        "team_b_score" integer,
        "set_scores" jsonb,
        "tournament_games" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_matches_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_matches_court"
          FOREIGN KEY ("court_id") REFERENCES "courts"("id"),
        CONSTRAINT "FK_matches_creator"
          FOREIGN KEY ("creator_id") REFERENCES "users"("id")
      )
    `);

    // Table: match_participants (composite PK)
    await queryRunner.query(`
      CREATE TABLE "match_participants" (
        "match_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "team_index" integer,
        "slot_index" integer,
        "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_match_participants" PRIMARY KEY ("match_id", "user_id"),
        CONSTRAINT "FK_match_participants_match"
          FOREIGN KEY ("match_id") REFERENCES "matches"("id"),
        CONSTRAINT "FK_match_participants_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);

    // Table: match_chat_messages
    await queryRunner.query(`
      CREATE TABLE "match_chat_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "match_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "body" character varying(2000) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_match_chat_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_match_chat_messages_match"
          FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_match_chat_messages_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);

    // Table: match_chat_mutes (composite PK)
    await queryRunner.query(`
      CREATE TABLE "match_chat_mutes" (
        "match_id" uuid NOT NULL,
        "muted_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_match_chat_mutes" PRIMARY KEY ("match_id", "muted_user_id"),
        CONSTRAINT "FK_match_chat_mutes_match"
          FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_match_chat_mutes_user"
          FOREIGN KEY ("muted_user_id") REFERENCES "users"("id")
      )
    `);

    // Table: tournament_fixtures
    await queryRunner.query(`
      CREATE TABLE "tournament_fixtures" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_match_id" uuid NOT NULL,
        "team_a_index" integer,
        "team_b_index" integer,
        "score_a" integer NOT NULL DEFAULT 0,
        "score_b" integer NOT NULL DEFAULT 0,
        "score_a_confirmed" boolean NOT NULL DEFAULT false,
        "score_b_confirmed" boolean NOT NULL DEFAULT false,
        "court_index" integer,
        "status" "public"."tournament_fixture_status_enum" NOT NULL DEFAULT 'pending',
        "depends_on_fixture_ids" jsonb,
        "feeds_fixture_id" uuid,
        "feeds_slot" character varying(1),
        "round" integer NOT NULL DEFAULT 0,
        "order" integer NOT NULL DEFAULT 0,
        "phase" character varying(24),
        "started_at" TIMESTAMP WITH TIME ZONE,
        "ended_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_fixtures_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tournament_fixtures_match"
          FOREIGN KEY ("event_match_id") REFERENCES "matches"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tournament_fixtures"`);
    await queryRunner.query(`DROP TABLE "match_chat_mutes"`);
    await queryRunner.query(`DROP TABLE "match_chat_messages"`);
    await queryRunner.query(`DROP TABLE "match_participants"`);
    await queryRunner.query(`DROP TABLE "matches"`);
    await queryRunner.query(`DROP TYPE "public"."tournament_fixture_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tournament_system_enum"`);
    await queryRunner.query(`DROP TYPE "public"."matches_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."matches_event_format_enum"`);
    await queryRunner.query(`DROP TYPE "public"."matches_volley_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."matches_skill_level_enum"`);
  }
}
