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

export const ANNOUNCEMENT_PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent',
] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export const ANNOUNCEMENT_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

@Entity('com_announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Index()
  @Column({ type: 'varchar', length: 10, default: 'normal' })
  priority: AnnouncementPriority;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: AnnouncementStatus;

  /** Quartier ciblé ; null = toute la ville. */
  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  zone: string | null;

  @Column({ name: 'cta_label', type: 'varchar', length: 120, nullable: true })
  ctaLabel: string | null;

  @Column({ name: 'cta_url', type: 'varchar', length: 500, nullable: true })
  ctaUrl: string | null;

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
