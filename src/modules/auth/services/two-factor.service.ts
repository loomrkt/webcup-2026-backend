import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { BCRYPT_ROUNDS } from '../auth.constants';
import { AttemptLimiter } from '../../../common/attempt-limiter';
import { TooManyRequestsException } from '../../../common/rate-limit.guard';
import { User } from '../entities/user.entity';
import { TokenService, TokenPair } from './token.service';
import { TotpService } from './totp.service';

export type LoginResult =
  | (TokenPair & { requiresTwoFactor: false })
  | { requiresTwoFactor: true; pendingToken: string };

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
    private readonly tokenService: TokenService,
    private readonly totpService: TotpService,
  ) {}

  private get enabled(): boolean {
    return (
      (this.config.get<string>('AUTH_ENABLE_2FA') ?? 'true').toLowerCase() ===
      'true'
    );
  }

  private readonly verifyLimiter = new AttemptLimiter(10, 15 * 60 * 1000);

  isActive(user: User): boolean {
    return !!(user as unknown as { totpActive?: boolean }).totpActive;
  }

  issuePendingLogin(user: User): {
    requiresTwoFactor: true;
    pendingToken: string;
  } {
    return {
      requiresTwoFactor: true,
      pendingToken: this.tokenService.signPending2faToken(user.id, user.email),
    };
  }

  async verifyTwoFactor(
    pendingToken: string,
    code: string,
  ): Promise<LoginResult> {
    if (!this.enabled) {
      throw new BadRequestException('Two-factor authentication is disabled');
    }
    const pending = this.tokenService.verifyPending2faToken(pendingToken);
    const user = await this.users.findOne({ where: { id: pending.sub } });
    if (
      !user ||
      !(user as unknown as { totpSecret?: string | null }).totpSecret
    ) {
      throw new UnauthorizedException('Two-factor not set up for this account');
    }
    if (this.verifyLimiter.isLocked(pending.sub)) {
      throw new TooManyRequestsException(
        `Too many failed attempts. Try again in ${this.verifyLimiter.retryAfterSec(pending.sub)}s.`,
      );
    }
    const valid = this.totpService.verify(
      (user as unknown as { totpSecret: string }).totpSecret,
      code,
    );
    if (!valid) {
      this.verifyLimiter.recordFailure(pending.sub);
      throw new UnauthorizedException('Invalid two-factor code');
    }
    this.verifyLimiter.reset(pending.sub);
    return {
      requiresTwoFactor: false,
      ...(await this.tokenService.issueTokenPair(user)),
    };
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
}
