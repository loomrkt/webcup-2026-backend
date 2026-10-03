import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Public E2EE key of a user (X25519 public key + signature of that key by
 * the account, to prevent MITM). The backend only stores and serves these
 * blobs — it never validates nor decrypts anything.
 */
@Entity('msg_user_keys')
export class UserKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  /** Signature of `publicKey` by the account (client-side scheme). */
  @Column({ type: 'text' })
  signature: string;

  @Column({ name: 'key_version', type: 'int', default: 1 })
  keyVersion: number;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
