import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * A user-to-user block. When A blocks B:
 * - B is filtered out of A's searches, suggestions, chat messages
 * - A is filtered out of B's searches, suggestions, chat messages (bidirectional)
 * - Pending follow requests between A and B are removed
 * - B cannot send new follow requests to A
 */
@Entity('user_blocks')
@Unique(['blockerId', 'blockedId'])
@Index('idx_user_blocks_blocker', ['blockerId'])
@Index('idx_user_blocks_blocked', ['blockedId'])
export class UserBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'blocker_id' })
  blockerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocker_id' })
  blocker: User;

  @Column({ name: 'blocked_id' })
  blockedId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocked_id' })
  blocked: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
