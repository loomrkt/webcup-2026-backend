export const BCRYPT_ROUNDS = 12;

export const TWO_FACTOR_SERVICE = 'TWO_FACTOR_SERVICE';
export const VERIFICATION_SERVICE = 'VERIFICATION_SERVICE';
export const RBAC_SERVICE = 'RBAC_SERVICE';

import type { User } from './entities/user.entity';

export type MfaFactor = 'totp' | 'email';

export interface TwoFactorService {
  isActive(user: User): boolean;
  issuePendingLogin(user: User): {
    requiresTwoFactor: true;
    pendingToken: string;
    factors: MfaFactor[];
  };
  verifyTwoFactor(
    pendingToken: string,
    code: string,
    context?: { ip?: string | null; userAgent?: string | null },
  ): Promise<unknown>;
  sendEmailMfaCode(
    pendingToken: string,
    context?: { ip?: string | null; userAgent?: string | null },
  ): Promise<{ sent: boolean; expiresInSec: number }>;
  enableEmailMfa(userId: string): Promise<{ mfaEmailActive: boolean }>;
  disableEmailMfa(
    userId: string,
    codeOrPassword: string,
  ): Promise<{ mfaEmailActive: boolean }>;
}

export interface VerificationService {
  sendVerificationEmail(user: User): Promise<void>;
}

export interface RbacService {
  assignDefaultAdminIfFirstUser(userId: string): Promise<void>;
  assignDefaultCitizenRoleIfMissing(userId: string): Promise<void>;
  rolesForUser(userId: string): Promise<Array<{ id: string; name: string }>>;
  effectivePermissions(userId: string): Promise<string[]>;
}
