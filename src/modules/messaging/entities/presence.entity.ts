import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PresenceStatus = 'online' | 'away' | 'offline';

/**
 * Presence of a user. In Phase 5 (Socket.IO) this is updated live on
 * connect/disconnect; until then it is set explicitly via PATCH /presence.
 */
@Entity('msg_presence')
export class Presence {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', default: 'offline' })
  status: PresenceStatus;

  @Column({
    name: 'last_seen_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastSeenAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
