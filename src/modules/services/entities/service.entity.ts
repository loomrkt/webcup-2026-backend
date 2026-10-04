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
import { Service as ServiceEntity } from './service.entity';

export const SERVICE_STATUSES = [
  'available',
  'maintenance',
  'incident',
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

@Entity('svc_services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true })
  icon: string | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  featured: boolean;

  @Column({ name: 'featured_order', type: 'int', default: 0 })
  featuredOrder: number;

  /** Disponibilité du service : disponible / maintenance / incident (F38). */
  @Index()
  @Column({ type: 'varchar', length: 20, default: 'available' })
  status: ServiceStatus;

  @Column({ name: 'status_message', type: 'text', nullable: true })
  statusMessage: string | null;

  @Column({ name: 'resume_at', type: 'timestamptz', nullable: true })
  resumeAt: Date | null;

  @ManyToOne(() => ServiceEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'alternative_service_id' })
  alternativeService: ServiceEntity | null;

  @Column({ name: 'alternative_service_id', type: 'uuid', nullable: true })
  alternativeServiceId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
