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

export const IDEA_STATUSES = [
  'received',
  'studied',
  'retained',
  'rejected',
  'realized',
] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

/** F68 — proposition d'idée d'un habitant pour améliorer la colonie. */
@Entity('civ_ideas')
export class CitizenIdea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  ref: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Index()
  @Column({ type: 'varchar', length: 12, default: 'received' })
  status: IdeaStatus;

  /** Note interne/retour visible par l'auteur. */
  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
