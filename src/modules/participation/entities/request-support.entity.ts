import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Request } from '../../requests/entities/request.entity';

/** F52 — soutien d'un habitant à une demande déjà déposée. */
@Entity('prt_request_supports')
@Unique('uq_request_support', ['requestId', 'userId'])
export class RequestSupport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Request, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: Request;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
