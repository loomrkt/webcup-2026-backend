import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mob_lines')
export class MobilityLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', unique: true, length: 20 })
  code: string;

  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  origin: string | null;

  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  destination: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  info: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  price: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  frequency: string | null;

  @Column({ type: 'boolean', default: true })
  accessible: boolean;

  @Index()
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
