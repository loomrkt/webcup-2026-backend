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
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { In, IsNull, Repository } from 'typeorm';
import {
  BCRYPT_ROUNDS,
  RBAC_SERVICE,
  RbacService,
  TWO_FACTOR_SERVICE,
  TwoFactorService,
  VERIFICATION_SERVICE,
  VerificationService,
  type MfaFactor,
} from '../auth.constants';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { AttemptLimiter } from '../../../common/attempt-limiter';
import { TooManyRequestsException } from '../../../common/rate-limit.guard';
import { hashToken } from '../utils/token.util';
import { EmailCodeService } from './email-code.service';
import { MailService } from './mail.service';
import { TokenService, TokenPair } from './token.service';
import {
  SecurityService,
  type LoginContext,
} from '../../security/security.service';
import { AuditService } from '../../audit/audit.service';

export type AuthUser = User &
  Partial<{
    emailVerifiedAt: Date | null;
    totpActive: boolean;
    totpSecret: string | null;
    recoveryCodes: string[] | null;
  }>;

export type LoginResult =
  | (TokenPair & { requiresTwoFactor: false })
  | {
      requiresTwoFactor: true;
      pendingToken: string;
      factors: MfaFactor[];
    };

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
    private readonly security: SecurityService,
    private readonly audit: AuditService,
    private readonly emailCodes: EmailCodeService,
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
      await this.rbac.assignDefaultCitizenRoleIfMissing(saved.id);
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

  async login(
    email: string,
    password: string,
    context: LoginContext = {},
  ): Promise<LoginResult> {
    const key = email.toLowerCase().trim();
    if (this.loginLimiter.isLocked(key)) {
      throw new TooManyRequestsException(
        `Too many failed attempts. Try again in ${this.loginLimiter.retryAfterSec(key)}s.`,
      );
    }
    const user = await this.validateCredentials(email, password);
    if (!user) {
      this.loginLimiter.recordFailure(key);
      const existing = await this.users.findOne({ where: { email: key } });
      if (existing && !existing.deletedAt) {
        const guard = await this.security.recordFailure(existing, context);
        if (guard.locked) {
          throw new TooManyRequestsException(
            `Account temporarily locked after repeated failures. Try again in ${guard.retryAfterSec}s.`,
          );
        }
      } else if (existing) {
        await this.security.log('login_failed', key, context, {
          reason: 'deleted_account',
        });
      }
      throw new UnauthorizedException('Invalid email or password');
    }
    this.loginLimiter.reset(key);
    if (user.deletedAt) {
      throw new UnauthorizedException('This account has been deleted');
    }
    if (user.status === 'suspended') {
      throw new ForbiddenException(
        'This account is suspended. Contact the municipality for assistance.',
      );
    }
    const guard = this.security.isLocked(user);
    if (guard.locked) {
      await this.security.log('login_locked', key, context, {
        userId: user.id,
      });
      throw new TooManyRequestsException(
        `Account temporarily locked. Try again in ${guard.retryAfterSec}s.`,
      );
    }
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
    await this.security.recordSuccess(user, context);
    return {
      requiresTwoFactor: false,
      ...(await this.tokenService.issueTokenPair(user, context)),
    };
  }

  async refresh(
    refreshToken: string,
    context: LoginContext = {},
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
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
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

  // ─── D02 : connexion sans mot de passe (code envoyé par email) ────────────

  private readonly passwordlessLimiter = new AttemptLimiter(5, 15 * 60 * 1000);

  async passwordlessRequest(
    email: string,
    context: LoginContext = {},
  ): Promise<void> {
    const user = await this.users.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || user.deletedAt) return;
    await this.emailCodes.deliver(
      user.id,
      user.email,
      'passwordless',
      10,
      'Votre code de connexion sans mot de passe',
    );
    await this.security.log('passwordless_requested', user.email, context, {
      userId: user.id,
    });
  }

  async passwordlessVerify(
    email: string,
    code: string,
    context: LoginContext = {},
  ): Promise<LoginResult> {
    const key = email.toLowerCase().trim();
    if (this.passwordlessLimiter.isLocked(key)) {
      throw new TooManyRequestsException(
        `Too many failed attempts. Try again in ${this.passwordlessLimiter.retryAfterSec(key)}s.`,
      );
    }
    const user = await this.users.findOne({ where: { email: key } });
    if (!user || user.deletedAt || !user.email) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    if (user.status === 'suspended') {
      throw new ForbiddenException(
        'This account is suspended. Contact the municipality for assistance.',
      );
    }
    const guard = this.security.isLocked(user);
    if (guard.locked) {
      throw new TooManyRequestsException(
        `Account temporarily locked. Try again in ${guard.retryAfterSec}s.`,
      );
    }
    const valid = await this.emailCodes.verify(user.id, 'passwordless', code);
    if (!valid) {
      this.passwordlessLimiter.recordFailure(key);
      throw new UnauthorizedException('Invalid or expired code');
    }
    this.passwordlessLimiter.reset(key);
    await this.emailCodes.invalidate(user.id, 'passwordless');
    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      await this.users.save(user);
    }
    await this.security.recordSuccess(user, context);
    await this.security.log('passwordless_verified', user.email, context, {
      userId: user.id,
    });
    if (this.enable2fa && this.twoFactor && this.twoFactor.isActive(user)) {
      return this.twoFactor.issuePendingLogin(user);
    }
    return {
      requiresTwoFactor: false,
      ...(await this.tokenService.issueTokenPair(user, context)),
    };
  }

  // ─── F54 : sessions actives et révocation ─────────────────────────────────

  async sessions(
    userId: string,
    currentRefreshToken?: string,
  ): Promise<
    Array<{
      id: string;
      ip: string | null;
      userAgent: string | null;
      createdAt: Date;
      expiresAt: Date;
      current: boolean;
    }>
  > {
    const now = new Date();
    const currentHash = currentRefreshToken
      ? hashToken(currentRefreshToken)
      : null;
    const tokens = await this.refreshTokens.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return tokens
      .filter((t) => t.expiresAt > now)
      .map((t) => ({
        id: t.id,
        ip: t.ip ?? null,
        userAgent: t.userAgent ?? null,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        current: currentHash !== null && t.token === currentHash,
      }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    context: LoginContext = {},
  ): Promise<{ id: string; revoked: boolean }> {
    const token = await this.refreshTokens.findOne({
      where: { id: sessionId, userId },
    });
    if (!token || token.revokedAt) {
      throw new NotFoundException('Session not found');
    }
    await this.refreshTokens.update(
      { id: token.id },
      { revokedAt: new Date() },
    );
    const user = await this.users.findOne({ where: { id: userId } });
    if (user) {
      await this.security.log('session_revoked', user.email, context, {
        userId,
        sessionId,
      });
    }
    return { id: token.id, revoked: true };
  }

  async revokeAllSessions(
    userId: string,
    exceptRefreshToken?: string,
    context: LoginContext = {},
  ): Promise<{ revoked: number }> {
    const exceptHash = exceptRefreshToken
      ? hashToken(exceptRefreshToken)
      : null;
    const tokens = await this.refreshTokens.find({
      where: { userId, revokedAt: IsNull() },
    });
    const toRevoke = tokens.filter(
      (t) => t.expiresAt > new Date() && t.token !== exceptHash,
    );
    if (toRevoke.length > 0) {
      await this.refreshTokens.update(
        { id: In(toRevoke.map((t) => t.id)) },
        { revokedAt: new Date() },
      );
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (user) {
      await this.security.log('session_revoked', user.email, context, {
        userId,
        revokedCount: toRevoke.length,
      });
    }
    return { revoked: toRevoke.length };
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const user = await this.users.findOne({ where: { id } });
    return user ? toAuthUser(user) : null;
  }

  async getProfile(userId: string): Promise<AuthUser | null> {
    return this.getUserById(userId);
  }

  async getProfileWithRoles(userId: string) {
    const user = await this.getUserById(userId);
    if (!user) return null;
    const roles = (await this.rbac?.rolesForUser(userId)) ?? [];
    const permissions = (await this.rbac?.effectivePermissions(userId)) ?? [];
    return {
      id: user.id,
      email: user.email,
      emailVerified: !!user.emailVerifiedAt,
      totpActive: user.totpActive ?? false,
      mfaEmailActive: user.mfaEmailActive ?? false,
      profile: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        city: user.city,
      },
      language: user.language ?? 'fr',
      preferences: user.preferences ?? {},
      onboarding: user.onboarding ?? {
        status: 'not_started',
        completedSteps: [],
      },
      roles,
      permissions,
    };
  }

  async updateProfile(
    userId: string,
    dto: {
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      address?: string | null;
      city?: string | null;
    },
  ): Promise<AuthUser | null> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.firstName !== undefined) user.firstName = dto.firstName ?? null;
    if (dto.lastName !== undefined) user.lastName = dto.lastName ?? null;
    if (dto.phone !== undefined) user.phone = dto.phone ?? null;
    if (dto.address !== undefined) user.address = dto.address ?? null;
    if (dto.city !== undefined) user.city = dto.city ?? null;
    return toAuthUser(await this.users.save(user));
  }

  async updatePreferences(
    userId: string,
    dto: {
      language?: string;
      textSize?: string;
      highContrast?: boolean;
      reducedMotion?: boolean;
      readableFont?: boolean;
      lineSpacing?: string;
      colorScheme?: string;
      colorBlind?: string;
      plainLanguage?: boolean;
    },
  ): Promise<AuthUser | null> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.language !== undefined) user.language = dto.language;
    const prefs = { ...(user.preferences ?? {}) };
    if (dto.textSize !== undefined) prefs.textSize = dto.textSize;
    if (dto.highContrast !== undefined) prefs.highContrast = dto.highContrast;
    if (dto.reducedMotion !== undefined) {
      prefs.reducedMotion = dto.reducedMotion;
    }
    if (dto.readableFont !== undefined) prefs.readableFont = dto.readableFont;
    if (dto.lineSpacing !== undefined) prefs.lineSpacing = dto.lineSpacing;
    if (dto.colorScheme !== undefined) prefs.colorScheme = dto.colorScheme;
    if (dto.colorBlind !== undefined) prefs.colorBlind = dto.colorBlind;
    if (dto.plainLanguage !== undefined) {
      prefs.plainLanguage = dto.plainLanguage;
    }
    user.preferences = prefs;
    return toAuthUser(await this.users.save(user));
  }

  async getOnboarding(userId: string): Promise<Record<string, unknown> | null> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user.onboarding ?? { status: 'not_started', completedSteps: [] };
  }

  async updateOnboarding(
    userId: string,
    dto: {
      status?: 'not_started' | 'in_progress' | 'completed';
      completedSteps?: string[];
    },
  ): Promise<Record<string, unknown> | null> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const onboarding = {
      status: 'not_started',
      completedSteps: [] as string[],
      ...(user.onboarding ?? {}),
    };
    if (dto.status !== undefined) onboarding.status = dto.status;
    if (dto.completedSteps !== undefined) {
      onboarding.completedSteps = [...new Set(dto.completedSteps)];
    }
    user.onboarding = onboarding;
    await this.users.save(user);
    return onboarding;
  }

  async profileCompletion(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const fields = [
      { key: 'firstName', filled: !!user.firstName },
      { key: 'lastName', filled: !!user.lastName },
      { key: 'phone', filled: !!user.phone },
      { key: 'address', filled: !!user.address },
      { key: 'city', filled: !!user.city },
      { key: 'emailVerified', filled: !!user.emailVerifiedAt },
    ];
    const filled = fields.filter((f) => f.filled).length;
    return {
      percentage: Math.round((filled / fields.length) * 100),
      missing: fields.filter((f) => !f.filled).map((f) => f.key),
      complete: filled === fields.length,
    };
  }

  async forgotPassword(
    email: string,
    context: LoginContext = {},
  ): Promise<void> {
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
      this.mailService.sendMailInBackground(
        user.email,
        'Reset your password',
        text,
      );
    } else if (this.config.get('NODE_ENV') !== 'production') {
      this.logger.warn(
        `Mail not configured — reset link for ${user.email}: ${link}`,
      );
    } else {
      throw new BadRequestException('Email service not configured');
    }
    await this.security.log('password_reset_requested', user.email, context, {
      userId: user.id,
    });
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
    await this.security.log(
      'password_reset',
      user.email,
      {},
      { userId: user.id },
    );
  }
}
