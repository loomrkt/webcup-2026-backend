import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import {
  BCRYPT_ROUNDS,
  RBAC_SERVICE,
  RbacService,
  TWO_FACTOR_SERVICE,
  TwoFactorService,
  VERIFICATION_SERVICE,
  VerificationService,
} from '../auth.constants';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { AttemptLimiter } from '../../../common/attempt-limiter';
import { TooManyRequestsException } from '../../../common/rate-limit.guard';
import { hashToken } from '../utils/token.util';
import { MailService } from './mail.service';
import { TokenService, TokenPair } from './token.service';

export type AuthUser = User &
  Partial<{
    emailVerifiedAt: Date | null;
    totpActive: boolean;
    totpSecret: string | null;
    recoveryCodes: string[] | null;
  }>;

export type LoginResult =
  | (TokenPair & { requiresTwoFactor: false })
  | { requiresTwoFactor: true; pendingToken: string };

export function toAuthUser(user: User): AuthUser {
  return user;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginLimiter = new AttemptLimiter(5, 15 * 60 * 1000);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    private readonly config: ConfigService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    @Optional()
    @Inject(TWO_FACTOR_SERVICE)
    private readonly twoFactor?: TwoFactorService | null,
    @Optional()
    @Inject(VERIFICATION_SERVICE)
    private readonly verification?: VerificationService | null,
    @Optional()
    @Inject(RBAC_SERVICE)
    private readonly rbac?: RbacService | null,
  ) {}

  private get enable2fa(): boolean {
    return (
      (this.config.get<string>('AUTH_ENABLE_2FA') ?? 'true').toLowerCase() ===
      'true'
    );
  }

  private get requireEmailVerification(): boolean {
    return (
      (
        this.config.get<string>('AUTH_REQUIRE_EMAIL_VERIFICATION') ?? 'true'
      ).toLowerCase() === 'true'
    );
  }

  get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  async register(email: string, password: string): Promise<AuthUser> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.users.findOne({ where: { email: normalized } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    const user = toAuthUser(
      this.users.create({ email: normalized, passwordHash }),
    );
    if (!this.requireEmailVerification) {
      user.emailVerifiedAt = new Date();
    }
    const saved = toAuthUser(await this.users.save(user));
    if (this.requireEmailVerification && this.verification) {
      await this.verification.sendVerificationEmail(saved);
    }
    if (this.rbac) {
      await this.rbac.assignDefaultAdminIfFirstUser(saved.id);
    }
    return saved;
  }

  private async storeResetToken(userId: string, token: string, hours: number) {
    const expiresAt = new Date(Date.now() + hours * 3600_000);
    await this.resetTokens.save(
      this.resetTokens.create({
        userId,
        tokenHash: hashToken(token),
        expiresAt,
      }),
    );
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.users.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || !user.passwordHash) return null;
    const ok = await compare(password, user.passwordHash);
    return ok ? toAuthUser(user) : null;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const key = email.toLowerCase().trim();
    if (this.loginLimiter.isLocked(key)) {
      throw new TooManyRequestsException(
        `Too many failed attempts. Try again in ${this.loginLimiter.retryAfterSec(key)}s.`,
      );
    }
    const user = await this.validateCredentials(email, password);
    if (!user) {
      this.loginLimiter.recordFailure(key);
      throw new UnauthorizedException('Invalid email or password');
    }
    this.loginLimiter.reset(key);
    if (
      this.requireEmailVerification &&
      this.verification &&
      !user.emailVerifiedAt
    ) {
      throw new ForbiddenException(
        'Email not verified. Check your inbox or resend the verification link.',
      );
    }
    if (this.enable2fa && this.twoFactor && this.twoFactor.isActive(user)) {
      return this.twoFactor.issuePendingLogin(user);
    }
    return {
      requiresTwoFactor: false,
      ...(await this.tokenService.issueTokenPair(user)),
    };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.tokenService.verifyRefreshToken(refreshToken);
    if (!payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const stored = await this.refreshTokens.findOne({
      where: { token: hashToken(refreshToken) },
    });
    if (!stored || stored.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.expiresAt < new Date()) {
      await this.refreshTokens.update(
        { id: stored.id },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Refresh token expired');
    }
    const user = await this.getUserById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    if (stored.userId !== user.id) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    const accessToken = this.tokenService.signAccessToken(user.id, user.email);
    const newRefreshToken = this.tokenService.signRefreshToken(user.id);
    const saved = await this.refreshTokens.save(
      this.refreshTokens.create({
        token: hashToken(newRefreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + this.refreshExpiryMs()),
      }),
    );
    await this.refreshTokens.update(
      { id: stored.id },
      { revokedAt: new Date(), replacedById: saved.id },
    );
    return { accessToken, refreshToken: newRefreshToken };
  }

  private refreshExpiryMs(): number {
    const exp = this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d';
    const match = exp.match(/(\d+)/);
    const days = match ? Number(match[1]) : 7;
    return days * 24 * 3600_000;
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findOne({
      where: { token: hashToken(refreshToken) },
    });
    if (stored && !stored.revokedAt) {
      await this.refreshTokens.update(
        { id: stored.id },
        { revokedAt: new Date() },
      );
    }
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const user = await this.users.findOne({ where: { id } });
    return user ? toAuthUser(user) : null;
  }

  async getProfile(userId: string): Promise<AuthUser | null> {
    return this.getUserById(userId);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
      return;
    }
    const token = randomBytes(32).toString('hex');
    await this.storeResetToken(user.id, token, 1);
    const link = `${this.frontendUrl}/reset-password?token=${token}`;
    const text = `Reset your password: ${link}`;
    if (this.mailService.isConfigured) {
      await this.mailService.sendMail(user.email, 'Reset your password', text);
    } else if (this.config.get('NODE_ENV') !== 'production') {
      this.logger.warn(
        `Mail not configured — reset link for ${user.email}: ${link}`,
      );
    } else {
      throw new BadRequestException('Email service not configured');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const record = await this.resetTokens.findOne({
      where: { tokenHash, usedAt: IsNull() },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const user = await this.users.findOne({ where: { id: record.userId } });
    if (!user) throw new NotFoundException('User not found');
    user.passwordHash = await hash(newPassword, BCRYPT_ROUNDS);
    await this.users.save(user);
    await this.resetTokens.update({ id: record.id }, { usedAt: new Date() });
  }
}
