import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlocksAndReports1700000000007 implements MigrationInterface {
  name = 'AddBlocksAndReports1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // user_blocks
    await queryRunner.query(`
      CREATE TABLE "user_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "blocker_id" uuid NOT NULL,
        "blocked_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_blocks_blocker_blocked" UNIQUE ("blocker_id", "blocked_id"),
        CONSTRAINT "FK_user_blocks_blocker" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_blocks_blocked" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_user_blocks_self" CHECK ("blocker_id" <> "blocked_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_blocks_blocker" ON "user_blocks" ("blocker_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_blocks_blocked" ON "user_blocks" ("blocked_id")`,
    );

    // reports
    await queryRunner.query(`
      CREATE TYPE "report_target_type_enum" AS ENUM ('user', 'chat_message')
    `);
    await queryRunner.query(`
      CREATE TYPE "report_reason_enum" AS ENUM ('spam', 'harassment', 'inappropriate', 'impersonation', 'other')
    `);
    await queryRunner.query(`
      CREATE TYPE "report_status_enum" AS ENUM ('pending', 'reviewed', 'dismissed')
    `);
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reporter_id" uuid NOT NULL,
        "target_type" "report_target_type_enum" NOT NULL,
        "target_id" uuid NOT NULL,
        "reason" "report_reason_enum" NOT NULL,
        "details" text,
        "status" "report_status_enum" NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_reports_status_created" ON "reports" ("status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reports_target" ON "reports" ("target_type", "target_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_reports_target"`);
    await queryRunner.query(`DROP INDEX "idx_reports_status_created"`);
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TYPE "report_status_enum"`);
    await queryRunner.query(`DROP TYPE "report_reason_enum"`);
    await queryRunner.query(`DROP TYPE "report_target_type_enum"`);

    await queryRunner.query(`DROP INDEX "idx_user_blocks_blocked"`);
    await queryRunner.query(`DROP INDEX "idx_user_blocks_blocker"`);
    await queryRunner.query(`DROP TABLE "user_blocks"`);
  }
}
