import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Match } from './match.entity';
import { User } from '../users/user.entity';

@Entity('match_participants')
export class MatchParticipant {
  @PrimaryColumn({ name: 'match_id' })
  matchId: string;

  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Match, (match) => match.participants)
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @ManyToOne(() => User, (user) => user.participations)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** 0 = équipe A, 1 = équipe B, null = non assigné */
  @Column({ name: 'team_index', type: 'int', nullable: true })
  teamIndex: number | null;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
