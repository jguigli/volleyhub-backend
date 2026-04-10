import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * DataSource standalone pour les migrations TypeORM CLI.
 * Utilisé uniquement par les commandes `typeorm migration:*`.
 *
 * Le runtime Nest utilise sa propre config dans app.module.ts.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgresql://volley:volley_secret@localhost:5432/volleyhub',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: true,
});
