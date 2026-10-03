import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('glossary_terms')
export class GlossaryTerm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', unique: true, length: 120 })
  term: string;

  /** Explication en langage simple (D13). */
  @Column({ type: 'text' })
  definition: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  category: string | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
