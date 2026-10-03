import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { User } from '../entities/user.entity';
import { hashToken } from '../utils/token.util';
import { MailService } from './mail.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
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

  async sendVerificationEmail(user: User): Promise<void> {
    const token = randomBytes(32).toString('hex');
    await this.storeResetToken(user.id, token, 24);
    const link = `${this.frontendUrl}/verify-email?token=${token}`;
    const text = `Confirm your email: ${link}`;
    if (this.mailService.isConfigured) {
      await this.mailService.sendMail(user.email, 'Confirm your email', text);
    } else if (this.config.get('NODE_ENV') !== 'production') {
      this.logger.warn(
        `Mail not configured — verification link for ${user.email}: ${link}`,
      );
    } else {
      throw new BadRequestException('Email service not configured');
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    const record = await this.resetTokens.findOne({
      where: { tokenHash, usedAt: IsNull() },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    const user = await this.users.findOne({ where: { id: record.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    (user as unknown as { emailVerifiedAt: Date }).emailVerifiedAt = new Date();
    await this.users.save(user);
    await this.resetTokens.update({ id: record.id }, { usedAt: new Date() });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) return;
    if (
      (user as unknown as { emailVerifiedAt?: Date | null }).emailVerifiedAt
    ) {
      throw new BadRequestException('Email already verified');
    }
    await this.sendVerificationEmail(user);
  }
}
