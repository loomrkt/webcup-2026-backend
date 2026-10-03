import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Index()
  @Column({ name: 'actor_email', type: 'varchar', length: 160, nullable: true })
  actorEmail: string | null;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  action: string;

  @Index()
  @Column({ name: 'entity_type', type: 'varchar', length: 60 })
  entityType: string;

  @Index()
  @Column({ name: 'entity_id', type: 'varchar', length: 120, nullable: true })
  entityId: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'json', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  after: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
