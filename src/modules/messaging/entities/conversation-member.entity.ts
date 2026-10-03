import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Conversation } from './conversation.entity';

export type MemberRole = 'admin' | 'member';

@Entity('msg_conversation_members')
export class ConversationMember {
  @PrimaryColumn({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ type: 'varchar', default: 'member' })
  role: MemberRole;

  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @Column({ type: 'boolean', default: false })
  muted: boolean;

  // @purge:groups-start
  /** E2EE: the conversation key, wrapped for this member (opaque blob). */
  @Column({ name: 'wrapped_conversation_key', type: 'text', nullable: true })
  wrappedConversationKey: string | null;

  /** E2EE: current conversation-key version for this member. */
  @Column({ name: 'key_version', type: 'int', default: 1 })
  keyVersion: number;
  // @purge:groups-end

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
