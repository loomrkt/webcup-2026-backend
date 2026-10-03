import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export const NOTIFICATION_TYPES = [
  'announcement',
  'alert',
  'system',
  'appointment',
  'reminder',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

@Entity('com_notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 10, default: 'normal' })
  priority: string;

  /** Association notification → annonce/alerte : { entityType, entityId, url }. */
  @Column({ type: 'json', nullable: true })
  payload: Record<string, unknown> | null;

  @Index()
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  /** Diffusion planifiée (rappels) ; null = diffusion immédiate. */
  @Index()
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
