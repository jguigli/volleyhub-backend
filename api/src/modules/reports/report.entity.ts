import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum ReportTargetType {
  USER = 'user',
  CHAT_MESSAGE = 'chat_message',
}

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  INAPPROPRIATE = 'inappropriate',
  IMPERSONATION = 'impersonation',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
}

/**
 * A user-submitted report against another user or piece of content.
 * Required by Apple App Store guideline 1.2 for apps with user-generated content.
 */
@Entity('reports')
@Index('idx_reports_status_created', ['status', 'createdAt'])
@Index('idx_reports_target', ['targetType', 'targetId'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reporter_id' })
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({
    type: 'enum',
    enum: ReportTargetType,
    name: 'target_type',
  })
  targetType: ReportTargetType;

  /** UUID of the reported user or chat message */
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @Column({
    type: 'enum',
    enum: ReportReason,
  })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
