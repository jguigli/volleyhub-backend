import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Match } from '../matches/match.entity';

export enum CourtType {
  INDOOR = 'indoor',
  OUTDOOR = 'outdoor',
}

@Entity('courts')
export class Court {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: CourtType,
    default: CourtType.OUTDOOR,
  })
  type: CourtType;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: string;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  /** True = lieu du référentiel (complexe / terrain connu), affiché en point bleu sur la carte */
  @Column({ name: 'is_registry', default: true })
  isRegistry: boolean;

  @OneToMany(() => Match, (match) => match.court)
  matches: Match[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
