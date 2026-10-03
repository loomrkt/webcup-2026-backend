import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Service } from '../../services/entities/service.entity';
import { RequestHistory } from './request-history.entity';

export const REQUEST_STATUSES = [
  'pending',
  'in_progress',
  'resolved',
  'rejected',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_PRIORITIES = ['low', 'normal', 'high'] as const;
export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];

@Entity('req_requests')
export class Request {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  ref: string;

  @Index()
  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @ManyToOne(() => Service, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: RequestStatus;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'normal' })
  priority: RequestPriority;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'citizen_id' })
  citizen: User;

  @Column({ name: 'citizen_id', type: 'uuid' })
  citizenId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: User | null;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedToId: string | null;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RequestHistory, (history) => history.request, {
    cascade: false,
  })
  history: RequestHistory[];
}
