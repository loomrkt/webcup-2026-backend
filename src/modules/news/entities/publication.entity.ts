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

@Entity('pub_publications')
export class Publication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  summary: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'cover_image', type: 'varchar', nullable: true })
  coverImage: string | null;

  @Column({ type: 'boolean', default: false })
  published: boolean;

  @Index()
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author: User | null;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
