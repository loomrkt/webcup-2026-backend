import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const SECURITY_EVENT_TYPES = [
  'login_success',
  'login_failed',
  'login_locked',
  'account_locked',
  'password_reset_requested',
  'password_reset',
  'email_verified',
  'two_factor_verified',
  'two_factor_failed',
  'passwordless_requested',
  'passwordless_verified',
  'mfa_email_sent',
  'new_device_login',
  'session_revoked',
] as const;
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

@Entity('sec_events')
export class SecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  type: SecurityEventType;

  @Index()
  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 300, nullable: true })
  userAgent: string | null;

  @Column({ type: 'json', nullable: true })
  details: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
