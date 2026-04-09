import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Match } from './match.entity';
import { User } from '../users/user.entity';

@Entity('match_chat_mutes')
export class MatchChatMute {
  @PrimaryColumn({ name: 'match_id' })
  matchId: string;

  @PrimaryColumn({ name: 'muted_user_id' })
  mutedUserId: string;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'muted_user_id' })
  mutedUser: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
