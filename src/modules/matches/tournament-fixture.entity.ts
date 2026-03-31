import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Match } from './match.entity';

export enum FixtureStatus {
  PENDING = 'pending',
  READY = 'ready',
  LIVE = 'live',
  FINISHED = 'finished',
}

/**
 * Une confrontation à l’intérieur d’un événement tournoi (≠ entité Match = événement).
 */
@Entity('tournament_fixtures')
export class TournamentFixtureMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_match_id' })
  eventMatchId: string;

  @ManyToOne(() => Match, (m) => m.tournamentFixtures, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_match_id' })
  eventMatch: Match;

  @Column({ type: 'int', name: 'team_a_index', nullable: true })
  teamAIndex: number | null;

  @Column({ type: 'int', name: 'team_b_index', nullable: true })
  teamBIndex: number | null;

  @Column({ type: 'int', name: 'score_a', default: 0 })
  scoreA: number;

  @Column({ type: 'int', name: 'score_b', default: 0 })
  scoreB: number;

  @Column({ type: 'int', name: 'court_index', nullable: true })
  courtIndex: number | null;

  @Column({
    type: 'enum',
    enum: FixtureStatus,
    enumName: 'tournament_fixture_status_enum',
    default: FixtureStatus.PENDING,
  })
  status: FixtureStatus;

  @Column({ type: 'jsonb', name: 'depends_on_fixture_ids', nullable: true })
  dependsOnFixtureIds: string[] | null;

  @Column({ name: 'feeds_fixture_id', type: 'uuid', nullable: true })
  feedsFixtureId: string | null;

  @Column({ name: 'feeds_slot', type: 'varchar', length: 1, nullable: true })
  feedsSlot: 'A' | 'B' | null;

  @Column({ type: 'int', default: 0 })
  round: number;

  @Column({ type: 'int', default: 0 })
  order: number;

  /** Ex. pool_a, pool_b, finals — optionnel */
  @Column({ type: 'varchar', length: 24, nullable: true })
  phase: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
