import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Consultation } from './consultation.entity';

/** F65 — réponse d'un habitant à une consultation. */
@Entity('civ_consultation_responses')
@Unique('uq_consultation_response', ['consultationId', 'userId'])
export class ConsultationResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Consultation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consultation_id' })
  consultation: Consultation;

  @Column({ name: 'consultation_id', type: 'uuid' })
  consultationId: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 200 })
  choice: string;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
