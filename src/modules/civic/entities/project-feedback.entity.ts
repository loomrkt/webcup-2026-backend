import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { CityProject } from './city-project.entity';

export const FEEDBACK_SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
export type FeedbackSentiment = (typeof FEEDBACK_SENTIMENTS)[number];

/** F66 — avis d'un habitant sur un projet de la ville (hors vote officiel). */
@Entity('civ_project_feedback')
@Unique('uq_project_feedback', ['projectId', 'userId'])
export class ProjectFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => CityProject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: CityProject;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  sentiment: FeedbackSentiment | null;

  /** Réponse libre. */
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
