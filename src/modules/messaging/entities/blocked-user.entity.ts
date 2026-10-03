import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * One-way block between two users (blockerId blocks blockedId). When a block
 * exists in either direction, no direct conversation can be started and the
 * blocked party cannot send messages.
 */
@Entity('msg_blocked_users')
export class BlockedUser {
  @PrimaryColumn({ name: 'blocker_id', type: 'uuid' })
  blockerId: string;

  @Index()
  @PrimaryColumn({ name: 'blocked_id', type: 'uuid' })
  blockedId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
