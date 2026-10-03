export const BCRYPT_ROUNDS = 12;

export const TWO_FACTOR_SERVICE = 'TWO_FACTOR_SERVICE';
export const VERIFICATION_SERVICE = 'VERIFICATION_SERVICE';
export const RBAC_SERVICE = 'RBAC_SERVICE';

import type { User } from './entities/user.entity';

export interface TwoFactorService {
  isActive(user: User): boolean;
  issuePendingLogin(user: User): {
    requiresTwoFactor: true;
    pendingToken: string;
  };
  verifyTwoFactor(pendingToken: string, code: string): Promise<unknown>;
}

export interface VerificationService {
  sendVerificationEmail(user: User): Promise<void>;
}

export interface RbacService {
  assignDefaultAdminIfFirstUser(userId: string): Promise<void>;
}
