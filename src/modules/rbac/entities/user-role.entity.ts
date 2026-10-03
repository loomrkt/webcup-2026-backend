import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Role } from './role.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => User, (user) => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Role, (role) => role.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  // @purge:hierarchy-start
  @Column({ name: 'can_create_sub_roles', type: 'boolean', default: false })
  canCreateSubRoles: boolean;

  @Column({ name: 'can_create_sub_users', type: 'boolean', default: false })
  canCreateSubUsers: boolean;
  // @purge:hierarchy-end

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
