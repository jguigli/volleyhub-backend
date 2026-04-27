import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { SkillLevel, Position, League } from '../../common/enums';
import { MatchParticipant } from '../matches/match-participant.entity';
import { Match } from '../matches/match.entity';

export { SkillLevel, Position, League };

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: SkillLevel,
    default: SkillLevel.BEGINNER,
    name: 'skill_level',
  })
  skillLevel: SkillLevel;

  @Column({
    type: 'enum',
    enum: Position,
    default: Position.ANY,
  })
  position: Position;

  @Column({ type: 'varchar', nullable: true })
  club: string | null;

  @Column({ type: 'varchar', nullable: true })
  competition: string | null;

  @Column({
    type: 'enum',
    enum: League,
    nullable: true,
  })
  league: League | null;

  @Column({ type: 'text', name: 'profile_picture', nullable: true })
  profilePicture: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 5, default: 'fr' })
  locale: string;

  @Column({ type: 'varchar', name: 'fcm_token', nullable: true })
  fcmToken: string | null;

  @Index()
  @Column({ type: 'varchar', name: 'password_reset_token', nullable: true })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', name: 'password_reset_expires_at', nullable: true })
  passwordResetExpiresAt: Date | null;

  /** Admin flag. True = panel admin access + hidden from all public endpoints. */
  @Column({ type: 'boolean', name: 'is_admin', default: false })
  isAdmin: boolean;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
    select: false,
  })
  location: string | null;

  @OneToMany(() => Match, (match) => match.creator)
  createdMatches: Match[];

  @OneToMany(() => MatchParticipant, (mp) => mp.user)
  participations: MatchParticipant[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
