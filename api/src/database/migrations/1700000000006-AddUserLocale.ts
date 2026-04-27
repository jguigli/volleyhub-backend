import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLocale1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "locale" varchar(5) NOT NULL DEFAULT 'fr'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locale"`);
  }
}
