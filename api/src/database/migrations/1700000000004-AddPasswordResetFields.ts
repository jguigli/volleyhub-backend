import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetFields1700000000004 implements MigrationInterface {
  name = 'AddPasswordResetFields1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "password_reset_token" character varying,
      ADD COLUMN "password_reset_expires_at" TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_password_reset_token" ON "users" ("password_reset_token")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_password_reset_token"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "password_reset_expires_at",
      DROP COLUMN "password_reset_token"
    `);
  }
}
