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
import { Conversation } from './conversation.entity';

@Entity('msg_messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Index()
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sender_id' })
  sender: User | null;

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId: string | null;

  /**
   * Opaque payload — encrypted ciphertext (E2EE) or plaintext when
   * MESSAGING_E2EE=false. The backend never interprets its content.
   */
  @Column({ type: 'text' })
  content: string;

  // @purge:e2ee-start
  @Column({ type: 'boolean', default: true })
  e2ee: boolean;

  /** AES-GCM initialisation vector (base64) — client-side. */
  @Column({ type: 'varchar', nullable: true })
  iv: string | null;

  /** Per-recipient wrapped message keys (base64 blobs) — client-side. */
  @Column({ type: 'json', nullable: true })
  wrappedKeys: Array<{ userId: string; key: string }> | null;
  // @purge:e2ee-end

  // @purge:replies-start
  @Column({ name: 'reply_to_id', type: 'uuid', nullable: true })
  replyToId: string | null;
  // @purge:replies-end

  // @purge:edit-delete-start
  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
  // @purge:edit-delete-end

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
