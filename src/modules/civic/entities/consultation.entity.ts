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

export const CONSULTATION_STATUSES = ['draft', 'open', 'closed'] as const;
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

/** F65 — consultation citoyenne : question + choix de réponses. */
@Entity('civ_consultations')
export class Consultation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 1000 })
  question: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Choix proposés (2 minimum). */
  @Column({ type: 'json' })
  choices: string[];

  /** Autorise un commentaire libre en plus du choix. */
  @Column({ name: 'allow_comments', type: 'boolean', default: true })
  allowComments: boolean;

  /** Résultats visibles par tous dès la clôture (ou en direct). */
  @Column({ name: 'results_public', type: 'boolean', default: false })
  resultsPublic: boolean;

  @Index()
  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status: ConsultationStatus;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

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
