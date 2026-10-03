import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { OAuthAccount } from './oauth-account.entity'; // @purge:oauth-import
import { UserRole } from '../../rbac/entities/user-role.entity'; // @purge:rbac-import
import { Organization } from '../../rbac/entities/organization.entity'; // @purge:tenant-import

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, type: 'varchar' })
  email: string;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  // @purge:2fa-start
  @Column({ name: 'totp_secret', type: 'varchar', nullable: true })
  totpSecret: string | null;

  @Column({ name: 'totp_active', type: 'boolean', default: false })
  totpActive: boolean;

  @Column({ name: 'recovery_codes', type: 'json', nullable: true })
  recoveryCodes: string[] | null;
  // @purge:2fa-end

  // @purge:verif-start
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;
  // @purge:verif-end

  @Column({ type: 'varchar', length: 10, default: 'fr' })
  language: string;

  @Column({ type: 'json', nullable: true })
  preferences: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  onboarding: Record<string, unknown> | null;

  @Column({ name: 'notification_prefs', type: 'json', nullable: true })
  notificationPrefs: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  // @purge:oauth-start
  @OneToMany(() => OAuthAccount, (account) => account.user)
  oauthAccounts: OAuthAccount[];
  // @purge:oauth-end

  // @purge:rbac-start
  // @purge:hierarchy-start
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent: User | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;
  // @purge:hierarchy-end

  // @purge:tenant-start
  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;
  // @purge:tenant-end

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];
  // @purge:rbac-end
}
