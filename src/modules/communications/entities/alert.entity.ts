import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export const ALERT_CRITICALITIES = ['info', 'warning', 'critical'] as const;
export type AlertCriticality = (typeof ALERT_CRITICALITIES)[number];

export const ALERT_STATUSES = ['draft', 'active', 'resolved'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

@Entity('com_alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** Consignes claires : que doivent faire les habitants. */
  @Column({ type: 'text' })
  message: string;

  @Index()
  @Column({ type: 'varchar', length: 10, default: 'warning' })
  criticality: AlertCriticality;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: AlertStatus;

  /** Zone/quartier ciblé ; null = toute la ville. */
  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  zone: string | null;

  @Column({ type: 'json', nullable: true })
  recommendations: string[] | null;

  /** Recommandations adaptées aux publics vulnérables (F31). */
  @Column({
    name: 'vulnerable_recommendations',
    type: 'json',
    nullable: true,
  })
  vulnerableRecommendations: string[] | null;

  @Column({ name: 'ai_generated', type: 'boolean', default: false })
  aiGenerated: boolean;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
