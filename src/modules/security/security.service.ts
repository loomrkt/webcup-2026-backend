import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { ListSecurityEventsQueryDto } from './dto/security.dto';
import {
  SecurityEvent,
  SecurityEventType,
} from './entities/security-event.entity';

export interface SecurityEventList {
  items: SecurityEvent[];
  total: number;
  page: number;
  limit: number;
}

export interface LoginContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface LoginGuardResult {
  locked: boolean;
  retryAfterSec: number;
}

@Injectable()
export class SecurityService {
  constructor(
    @InjectRepository(SecurityEvent)
    private readonly events: Repository<SecurityEvent>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async log(
    type: SecurityEventType,
    email: string | null,
    context: LoginContext,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.events.save(
        this.events.create({
          type,
          email,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          details: details ?? null,
        }),
      );
    } catch {
      // le journal de sécurité ne doit jamais faire échouer l'authentification
    }
  }

  /** Vérifie le verrouillage persistant d'un compte (F37). */
  isLocked(user: Pick<User, 'lockedUntil'>): LoginGuardResult {
    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      return {
        locked: true,
        retryAfterSec: Math.ceil((user.lockedUntil.getTime() - now) / 1000),
      };
    }
    return { locked: false, retryAfterSec: 0 };
  }

  /**
   * Enregistre un échec de connexion et verrouille le compte après
   * `AUTH_MAX_FAILED_ATTEMPTS` échecs pendant `AUTH_LOCK_DURATION_MINUTES`.
   * Renvoie l'état de verrouillage après cet échec.
   */
  async recordFailure(
    user: User,
    context: LoginContext,
  ): Promise<LoginGuardResult> {
    const maxAttempts = Number(process.env.AUTH_MAX_FAILED_ATTEMPTS ?? '5');
    const lockMinutes = Number(process.env.AUTH_LOCK_DURATION_MINUTES ?? '15');
    const now = new Date();
    user.failedLoginCount = (user.failedLoginCount ?? 0) + 1;
    user.lastFailedAt = now;
    if (user.failedLoginCount >= maxAttempts) {
      user.lockedUntil = new Date(now.getTime() + lockMinutes * 60_000);
      user.failedLoginCount = 0;
      await this.users.save(user);
      await this.log('account_locked', user.email, context, {
        maxAttempts,
        lockMinutes,
        userId: user.id,
      });
      return {
        locked: true,
        retryAfterSec: lockMinutes * 60,
      };
    }
    await this.users.save(user);
    await this.log('login_failed', user.email, context, {
      attempts: user.failedLoginCount,
      maxAttempts,
    });
    return { locked: false, retryAfterSec: 0 };
  }

  /** Réinitialise le compteur et le verrouillage après un login réussi. */
  async recordSuccess(user: User, context: LoginContext): Promise<void> {
    if (user.failedLoginCount || user.lockedUntil || user.lastFailedAt) {
      user.failedLoginCount = 0;
      user.lastFailedAt = null;
      user.lockedUntil = null;
      await this.users.save(user);
    }
    await this.log('login_success', user.email, context, { userId: user.id });
  }

  async list(query: ListSecurityEventsQueryDto): Promise<SecurityEventList> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Record<string, unknown> = {};
    if (query.email) where.email = query.email.toLowerCase().trim();
    if (query.type) where.type = query.type;
    if (query.from || query.to) {
      const from = query.from ? new Date(query.from) : new Date(0);
      const to = query.to ? new Date(query.to) : new Date();
      where.createdAt = Between(from, to);
    }
    const [items, total] = await this.events.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  /** Comptes actuellement verrouillés (pour le suivi agent). */
  async lockedAccounts(): Promise<
    Array<Pick<User, 'id' | 'email' | 'lockedUntil' | 'lastFailedAt'>>
  > {
    const now = new Date();
    return this.users
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.lockedUntil',
        'user.lastFailedAt',
      ])
      .where('user.lockedUntil > :now', { now })
      .orderBy('user.lockedUntil', 'ASC')
      .getMany();
  }
}
