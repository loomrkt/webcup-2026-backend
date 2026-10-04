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
import { Service } from './service.entity';

/** F63 — journal des changements d'état d'un service (activation/statut). */
@Entity('svc_status_history')
export class ServiceStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ type: 'boolean' })
  active: boolean;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  /** Motif / raison du changement d'état (F63). */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by' })
  changedBy: User | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
