import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PROJECT_STATUSES = [
  'planned',
  'in_progress',
  'paused',
  'completed',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** F67 — projet municipal visible par les habitants. */
@Entity('civ_projects')
export class CityProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'planned' })
  status: ProjectStatus;

  /** Avancement en pourcentage (0-100). */
  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  responsible: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /** Prochaines étapes, lisibles sans explication technique. */
  @Column({ name: 'next_steps', type: 'text', nullable: true })
  nextSteps: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
