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

export const DATA_CONCERN_STATUSES = [
  'new',
  'acknowledged',
  'answered',
] as const;
export type DataConcernStatus = (typeof DATA_CONCERN_STATUSES)[number];

/** F51 — remontée des préoccupations des habitants sur l'utilisation des données. */
@Entity('prt_data_concerns')
export class DataConcern {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  category: string | null;

  @Column({ type: 'text' })
  message: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: DataConcernStatus;

  /** Réponse de la municipalité, visible par l'habitant. */
  @Column({ type: 'text', nullable: true })
  response: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'responded_by' })
  respondedBy: User | null;

  @Column({ name: 'responded_by', type: 'uuid', nullable: true })
  respondedById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
