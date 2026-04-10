import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersModule1700000000002 implements MigrationInterface {
  name = 'UsersModule1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums for users
    await queryRunner.query(`
      CREATE TYPE "public"."users_skill_level_enum" AS ENUM ('beginner', 'intermediate', 'advanced')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."users_position_enum" AS ENUM (
        'setter', 'libero', 'outside_hitter', 'opposite_hitter', 'middle_blocker', 'any'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."users_league_enum" AS ENUM (
        'departmental', 'regional', 'pre_national', 'national', 'professional'
      )
    `);

    // Table: users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "skill_level" "public"."users_skill_level_enum" NOT NULL DEFAULT 'beginner',
        "position" "public"."users_position_enum" NOT NULL DEFAULT 'any',
        "club" character varying,
        "competition" character varying,
        "league" "public"."users_league_enum",
        "profile_picture" text,
        "bio" text,
        "fcm_token" character varying,
        "location" geography(Point, 4326),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )
    `);

    // Table: follows (mutual relationships)
    await queryRunner.query(`
      CREATE TABLE "follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "follower_id" uuid NOT NULL,
        "following_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_follows_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_follows_pair" UNIQUE ("follower_id", "following_id"),
        CONSTRAINT "FK_follows_follower"
          FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_follows_following"
          FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Table: follow_requests (pending connection requests)
    await queryRunner.query(`
      CREATE TABLE "follow_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requester_id" uuid NOT NULL,
        "target_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_follow_requests_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_follow_requests_pair" UNIQUE ("requester_id", "target_id"),
        CONSTRAINT "FK_follow_requests_requester"
          FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_follow_requests_target"
          FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "follow_requests"`);
    await queryRunner.query(`DROP TABLE "follows"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_league_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_position_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_skill_level_enum"`);
  }
}
