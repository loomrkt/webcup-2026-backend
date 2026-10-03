import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export type ReceiptStatus = 'delivered' | 'read';

/**
 * Per-message read receipt. The conversation cursor (ConversationMember
 * lastReadAt) drives unread counts; receipts give per-message granularity
 * (e.g. "who has read this message" in groups).
 */
@Entity('msg_message_receipts')
export class MessageReceipt {
  @PrimaryColumn({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Index()
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', default: 'read' })
  status: ReceiptStatus;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
