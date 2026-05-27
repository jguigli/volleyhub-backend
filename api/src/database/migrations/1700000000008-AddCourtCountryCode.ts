import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourtCountryCode1700000000008 implements MigrationInterface {
  name = 'AddCourtCountryCode1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "courts" ADD COLUMN "country_code" varchar(2)`,
    );

    // Backfill: previous releases stored the country name returned by
    // expo-location, which uses the device's system language. Some users
    // ended up with localized strings ("Pháp" = France in Vietnamese,
    // "Prancis" = France in Indonesian) appended to `address`. Strip the
    // localized country segment and set country_code = 'FR'.
    await queryRunner.query(`
      UPDATE "courts"
         SET country_code = 'FR',
             address = NULLIF(regexp_replace(address, ',\\s*(Pháp|Prancis)\\s*$', ''), '')
       WHERE address ~ ',\\s*(Pháp|Prancis)\\s*$'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "courts" DROP COLUMN "country_code"`);
  }
}
