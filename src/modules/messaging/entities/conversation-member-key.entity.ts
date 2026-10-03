import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Historical per-member wrapped conversation keys (E2EE groups). When a
 * member is removed the conversation key is rotated: the current wrapped key
 * of each remaining member is archived here (with its version) so old
 * messages stay decryptable, while the member's row moves to the new version.
 */
@Entity('msg_conversation_member_keys')
export class ConversationMemberKey {
  @PrimaryColumn({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'key_version', type: 'int' })
  keyVersion: number;

  /** Client-side wrapped conversation key blob (opaque). */
  @Column({ name: 'wrapped_key', type: 'text' })
  wrappedKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
