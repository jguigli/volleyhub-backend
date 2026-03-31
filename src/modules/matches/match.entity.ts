import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import {
  EventFormat,
  SkillLevel,
  TournamentSystem,
  VolleyType,
} from '../../common/enums';
import { User } from '../users/user.entity';
import { Court } from '../courts/court.entity';
import { MatchParticipant } from './match-participant.entity';
import { TournamentFixtureMatch } from './tournament-fixture.entity';

export enum MatchStatus {
  OPEN = 'open',
  FULL = 'full',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'court_id' })
  courtId: string;

  @ManyToOne(() => Court, (court) => court.matches)
  @JoinColumn({ name: 'court_id' })
  court: Court;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @ManyToOne(() => User, (user) => user.createdMatches)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ name: 'max_players', type: 'int', default: 12 })
  maxPlayers: number;

  @Column({ name: 'current_players', type: 'int', default: 0 })
  currentPlayers: number;

  @Column({
    type: 'enum',
    enum: SkillLevel,
    default: SkillLevel.BEGINNER,
    name: 'skill_level',
  })
  skillLevel: SkillLevel;

  @Column({
    type: 'enum',
    enum: VolleyType,
    default: VolleyType.CLASSIC,
    name: 'volley_type',
  })
  volleyType: VolleyType;

  @Column({
    type: 'enum',
    enum: EventFormat,
    default: EventFormat.MATCH,
    name: 'event_format',
  })
  eventFormat: EventFormat;

  @Column({ name: 'team_count', type: 'int', nullable: true })
  teamCount: number | null;

  @Column({ name: 'team_size', type: 'int', nullable: true })
  teamSize: number | null;

  /** Simple match: max sets in the match (e.g. best-of). Null for tournaments. */
  @Column({ name: 'match_sets', type: 'int', nullable: true })
  matchSets: number | null;

  /** Simple match: points to win a set. Null for tournaments. */
  @Column({ name: 'points_to_win', type: 'int', nullable: true })
  pointsToWin: number | null;

  /** Tournament: points to win each bracket match. Null for simple matches. */
  @Column({ name: 'tournament_points_per_match', type: 'int', nullable: true })
  tournamentPointsPerMatch: number | null;

  /** Tournament: parallel courts (terrains) for scheduling. */
  @Column({ name: 'tournament_court_count', type: 'int', nullable: true })
  tournamentCourtCount: number | null;

  /** Tournament: bracket, pools+finals, or round-robin. */
  @Column({
    type: 'enum',
    enum: TournamentSystem,
    enumName: 'tournament_system_enum',
    name: 'tournament_system',
    nullable: true,
  })
  tournamentSystem: TournamentSystem | null;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.OPEN,
  })
  status: MatchStatus;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  /** Final score team A (créateur côté gauche / équipe 1), match simple uniquement. */
  @Column({ name: 'team_a_score', type: 'int', nullable: true })
  teamAScore: number | null;

  @Column({ name: 'team_b_score', type: 'int', nullable: true })
  teamBScore: number | null;

  /** Per-set points: [{ teamA, teamB }, ...] */
  @Column({ name: 'set_scores', type: 'jsonb', nullable: true })
  setScores: { teamA: number; teamB: number }[] | null;

  /** Tournoi : confrontations avec scores, tour, terrain. */
  @Column({ name: 'tournament_games', type: 'jsonb', nullable: true })
  tournamentGames: {
    teamAIndex: number;
    teamBIndex: number;
    scoreA: number;
    scoreB: number;
    courtIndex?: number;
    round?: number;
    order?: number;
  }[] | null;

  /** Pas de cascade : les lignes passent par `participantRepo` pour éviter les flush incorrects (ex. join tournoi). */
  @OneToMany(() => MatchParticipant, (mp) => mp.match)
  participants: MatchParticipant[];

  @OneToMany(() => TournamentFixtureMatch, (f) => f.eventMatch)
  tournamentFixtures: TournamentFixtureMatch[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
