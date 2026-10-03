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

export const CONTACT_STATUSES = ['new', 'read', 'answered'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

@Entity('ctc_contact_messages')
export class ContactMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 160 })
  email: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  subject: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category: string | null;

  @Column({ type: 'text' })
  message: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: ContactStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'handled_by' })
  handledBy: User | null;

  @Column({ name: 'handled_by', type: 'uuid', nullable: true })
  handledById: string | null;

  @Column({ name: 'handled_at', type: 'timestamptz', nullable: true })
  handledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
