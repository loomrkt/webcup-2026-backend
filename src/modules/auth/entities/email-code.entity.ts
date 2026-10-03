import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export const EMAIL_CODE_PURPOSES = ['passwordless', 'mfa'] as const;
export type EmailCodePurpose = (typeof EMAIL_CODE_PURPOSES)[number];

/**
 * Code à usage unique envoyé par email :
 * - `passwordless` : connexion sans mot de passe (D02) ;
 * - `mfa` : seconde étape de vérification (F53).
 */
@Entity('email_codes')
export class EmailCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  purpose: EmailCodePurpose;

  @Column({ name: 'code_hash', type: 'varchar', length: 200 })
  codeHash: string;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
