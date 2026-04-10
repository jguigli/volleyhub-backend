import { MigrationInterface, QueryRunner } from 'typeorm';

export class CourtsModule1700000000001 implements MigrationInterface {
  name = 'CourtsModule1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostGIS extension required for geography(Point, 4326)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Enum: court type
    await queryRunner.query(`
      CREATE TYPE "public"."courts_type_enum" AS ENUM ('indoor', 'outdoor')
    `);

    // Table: courts
    await queryRunner.query(`
      CREATE TABLE "courts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "type" "public"."courts_type_enum" NOT NULL DEFAULT 'outdoor',
        "location" geography(Point, 4326) NOT NULL,
        "address" character varying,
        "is_registry" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courts_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "courts"`);
    await queryRunner.query(`DROP TYPE "public"."courts_type_enum"`);
  }
}
