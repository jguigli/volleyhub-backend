import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsAdminField1700000000005 implements MigrationInterface {
  name = 'AddIsAdminField1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "is_admin" boolean NOT NULL DEFAULT false
    `);
    // Partial index for fast admin lookups (almost all rows are false)
    await queryRunner.query(`
      CREATE INDEX "IDX_users_is_admin" ON "users" ("is_admin") WHERE "is_admin" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_is_admin"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_admin"`);
  }
}
