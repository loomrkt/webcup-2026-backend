import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { BCRYPT_ROUNDS } from '../auth.constants';
import { AttemptLimiter } from '../../../common/attempt-limiter';
import { TooManyRequestsException } from '../../../common/rate-limit.guard';
import { User } from '../entities/user.entity';
import {
  SecurityService,
  type LoginContext,
} from '../../security/security.service';
import { EmailCodeService } from './email-code.service';
import { MailService } from './mail.service';
import { TokenService, TokenPair } from './token.service';
import { TotpService } from './totp.service';

export type MfaFactor = 'totp' | 'email';

export type LoginResult =
  | (TokenPair & { requiresTwoFactor: false })
  | {
      requiresTwoFactor: true;
      pendingToken: string;
      factors: MfaFactor[];
    };

const EMAIL_MFA_TTL_MINUTES = 5;

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
    private readonly tokenService: TokenService,
    private readonly totpService: TotpService,
    private readonly emailCodes: EmailCodeService,
    private readonly mail: MailService,
    private readonly security: SecurityService,
  ) {}

  private get enabled(): boolean {
    return (
      (this.config.get<string>('AUTH_ENABLE_2FA') ?? 'true').toLowerCase() ===
      'true'
    );
  }

  private readonly verifyLimiter = new AttemptLimiter(10, 15 * 60 * 1000);

  isActive(user: User): boolean {
    return (
      !!(user as unknown as { totpActive?: boolean }).totpActive ||
      !!(user as unknown as { mfaEmailActive?: boolean }).mfaEmailActive
    );
  }

  activeFactors(user: User): MfaFactor[] {
    const factors: MfaFactor[] = [];
    if ((user as unknown as { totpActive?: boolean }).totpActive) {
      factors.push('totp');
    }
    if ((user as unknown as { mfaEmailActive?: boolean }).mfaEmailActive) {
      factors.push('email');
    }
    return factors;
  }

  issuePendingLogin(user: User): {
    requiresTwoFactor: true;
    pendingToken: string;
    factors: MfaFactor[];
  } {
    return {
      requiresTwoFactor: true,
      pendingToken: this.tokenService.signPending2faToken(user.id, user.email),
      factors: this.activeFactors(user),
    };
  }

  async verifyTwoFactor(
    pendingToken: string,
    code: string,
    context: LoginContext = {},
  ): Promise<LoginResult> {
    if (!this.enabled) {
      throw new BadRequestException('Two-factor authentication is disabled');
    }
    const pending = this.tokenService.verifyPending2faToken(pendingToken);
    const user = await this.users.findOne({ where: { id: pending.sub } });
    if (!user || !this.isActive(user)) {
      throw new UnauthorizedException('Two-factor not set up for this account');
    }
    if (this.verifyLimiter.isLocked(pending.sub)) {
      throw new TooManyRequestsException(
        `Too many failed attempts. Try again in ${this.verifyLimiter.retryAfterSec(pending.sub)}s.`,
      );
    }
    const flags = user as unknown as {
      totpActive?: boolean;
      totpSecret?: string | null;
      mfaEmailActive?: boolean;
    };
    let valid = false;
    if (flags.totpActive && flags.totpSecret) {
      valid = this.totpService.verify(flags.totpSecret, code);
    }
    if (!valid && flags.mfaEmailActive) {
      valid = await this.emailCodes.verify(user.id, 'mfa', code);
    }
    if (!valid) {
      this.verifyLimiter.recordFailure(pending.sub);
      await this.security.log('two_factor_failed', user.email, context, {
        userId: user.id,
      });
      throw new UnauthorizedException('Invalid two-factor code');
    }
    this.verifyLimiter.reset(pending.sub);
    await this.security.recordSuccess(user, context);
    await this.security.log('two_factor_verified', user.email, context, {
      userId: user.id,
    });
    return {
      requiresTwoFactor: false,
      ...(await this.tokenService.issueTokenPair(user, context)),
    };
  }

  /** F53 — envoie un code de vérification par email pour terminer la connexion. */
  async sendEmailMfaCode(
    pendingToken: string,
    context: LoginContext = {},
  ): Promise<{ sent: boolean; expiresInSec: number }> {
    if (!this.enabled) {
      throw new BadRequestException('Two-factor authentication is disabled');
    }
    const pending = this.tokenService.verifyPending2faToken(pendingToken);
    const user = await this.users.findOne({ where: { id: pending.sub } });
    const flags = user as unknown as { mfaEmailActive?: boolean };
    if (!user || !flags.mfaEmailActive) {
      throw new BadRequestException('Email verification is not enabled');
    }
    await this.emailCodes.deliver(
      user.id,
      user.email,
      'mfa',
      EMAIL_MFA_TTL_MINUTES,
      'Votre code de vérification Nova Terra',
    );
    await this.security.log('mfa_email_sent', user.email, context, {
      userId: user.id,
    });
    return { sent: true, expiresInSec: EMAIL_MFA_TTL_MINUTES * 60 };
  }

  /** F53 — active la vérification par code email. */
  async enableEmailMfa(userId: string): Promise<{ mfaEmailActive: boolean }> {
    if (!this.enabled) {
      throw new BadRequestException('Two-factor authentication is disabled');
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (
      !(user as unknown as { emailVerifiedAt?: Date | null }).emailVerifiedAt
    ) {
      throw new BadRequestException('Verify your email address first');
    }
    (user as unknown as { mfaEmailActive: boolean }).mfaEmailActive = true;
    await this.users.save(user);
    return { mfaEmailActive: true };
  }

  /** F53 — désactive la vérification par code email (code TOTP ou mot de passe requis). */
  async disableEmailMfa(
    userId: string,
    codeOrPassword: string,
  ): Promise<{ mfaEmailActive: boolean }> {
    if (!this.enabled) {
      throw new BadRequestException('Two-factor authentication is disabled');
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const flags = user as unknown as {
      mfaEmailActive: boolean;
      totpSecret: string | null;
      passwordHash: string | null;
    };
    if (!flags.mfaEmailActive) {
      throw new BadRequestException('Email verification is not active');
    }
    const isTotp =
      flags.totpSecret &&
      this.totpService.verify(flags.totpSecret, codeOrPassword);
    const isPassword =
      flags.passwordHash && (await compare(codeOrPassword, flags.passwordHash));
    if (!isTotp && !isPassword) {
      throw new UnauthorizedException('Invalid code or password');
    }
    flags.mfaEmailActive = false;
    await this.emailCodes.invalidate(user.id, 'mfa');
    await this.users.save(user);
    return { mfaEmailActive: false };
  }

  async setup(userId: string, email: string) {
    if (!this.enabled) {
      throw new BadRequestException('Two-factor authentication is disabled');
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const secret = this.totpService.generateSecret();
    (user as unknown as { totpSecret: string | null }).totpSecret = secret;
    await this.users.save(user);
    return {
      secret,
      qrDataUrl: await this.totpService.generateQrDataUri(secret, email),
    };
  }

  async activate(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    if (!this.enabled) {
      throw new BadRequestException('Two-factor authentication is disabled');
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const secret = (user as unknown as { totpSecret?: string | null })
      .totpSecret;
    if (!secret) {
      throw new BadRequestException('No pending 2FA setup');
    }
    if (!this.totpService.verify(secret, code)) {
      throw new BadRequestException('Invalid authentication code');
    }
    const codes: string[] = Array.from({ length: 8 }, () =>
      randomBytes(5).toString('hex').slice(0, 10).toUpperCase(),
    );
    const codeHashes = await Promise.all(
      codes.map((c) => hash(c, BCRYPT_ROUNDS)),
    );
    const flags = user as unknown as {
      totpActive: boolean;
      recoveryCodes: string[] | null;
    };
    flags.totpActive = true;
    flags.recoveryCodes = codeHashes;
    await this.users.save(user);
    return { recoveryCodes: codes };
  }

  async deactivate(userId: string, codeOrPassword: string): Promise<void> {
    if (!this.enabled) {
      throw new BadRequestException('Two-factor authentication is disabled');
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const flags = user as unknown as {
      totpActive: boolean;
      totpSecret: string | null;
      recoveryCodes: string[] | null;
      passwordHash: string | null;
    };
    if (!flags.totpActive) {
      throw new BadRequestException('2FA is not active');
    }
    const isTotp =
      flags.totpSecret &&
      this.totpService.verify(flags.totpSecret, codeOrPassword);
    const isPassword =
      flags.passwordHash && (await compare(codeOrPassword, flags.passwordHash));
    if (!isTotp && !isPassword) {
      throw new UnauthorizedException('Invalid code or password');
    }
    flags.totpActive = false;
    flags.totpSecret = null;
    flags.recoveryCodes = null;
    await this.users.save(user);
  }

  async verifyRecoveryCode(
    userId: string,
    code: string,
  ): Promise<LoginResult | null> {
    if (this.verifyLimiter.isLocked(userId)) {
      throw new TooManyRequestsException(
        `Too many failed attempts. Try again in ${this.verifyLimiter.retryAfterSec(userId)}s.`,
      );
    }
    const user = await this.users.findOne({ where: { id: userId } });
    const flags = user as unknown as { recoveryCodes?: string[] | null };
    if (!user || !flags.recoveryCodes) return null;
    for (const stored of flags.recoveryCodes) {
      if (await compare(code, stored)) {
        this.verifyLimiter.reset(userId);
        flags.recoveryCodes = flags.recoveryCodes.filter((c) => c !== stored);
        await this.users.save(user);
        return {
          requiresTwoFactor: false,
          ...(await this.tokenService.issueTokenPair(user)),
        };
      }
    }
    this.verifyLimiter.recordFailure(userId);
    return null;
  }

  /**
   * F53 — finalise la connexion avec un code de récupération (B1).
   * Résout l'utilisateur depuis le pendingToken puis délègue à verifyRecoveryCode.
   */
  async verifyRecovery(
    pendingToken: string,
    code: string,
    context: LoginContext = {},
  ): Promise<LoginResult> {
    if (!this.enabled) {
      throw new BadRequestException('Two-factor authentication is disabled');
    }
    const pending = this.tokenService.verifyPending2faToken(pendingToken);
    const user = await this.users.findOne({ where: { id: pending.sub } });
    if (!user || !this.isActive(user)) {
      throw new UnauthorizedException('Two-factor not set up for this account');
    }
    const result = await this.verifyRecoveryCode(user.id, code);
    if (!result) {
      await this.security.log('two_factor_failed', user.email, context, {
        userId: user.id,
        reason: 'recovery',
      });
      throw new UnauthorizedException('Invalid recovery code');
    }
    await this.security.recordSuccess(user, context);
    await this.security.log('two_factor_verified', user.email, context, {
      userId: user.id,
      via: 'recovery',
    });
    return result;
  }
}
