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
import { Service } from '../../services/entities/service.entity';
import { User } from '../../auth/entities/user.entity';
import { AppointmentSlot } from './appointment-slot.entity';

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'cancelled',
  'completed',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

@Entity('apt_appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  ref: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'citizen_id' })
  citizen: User;

  @Column({ name: 'citizen_id', type: 'uuid' })
  citizenId: string;

  @Index()
  @ManyToOne(() => AppointmentSlot, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'slot_id' })
  slot: AppointmentSlot;

  @Column({ name: 'slot_id', type: 'uuid', unique: true })
  slotId: string;

  @ManyToOne(() => Service, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agent_id' })
  agent: User | null;

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Index()
  @Column({ type: 'varchar', length: 12, default: 'scheduled' })
  status: AppointmentStatus;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Délai du rappel en minutes avant le rendez-vous (F40). */
  @Column({ name: 'reminder_minutes', type: 'int', default: 60 })
  reminderMinutes: number;

  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
