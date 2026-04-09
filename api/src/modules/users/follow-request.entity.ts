import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

/** Demande de connexion en attente (acceptation → création d’une entrée `follows`). */
@Entity('follow_requests')
@Unique(['requesterId', 'targetId'])
export class FollowRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'requester_id' })
  requesterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_id' })
  requester: User;

  @Column({ name: 'target_id' })
  targetId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_id' })
  target: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
