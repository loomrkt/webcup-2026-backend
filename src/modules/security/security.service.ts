import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CommunicationsService } from '../communications/communications.service';
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
    private readonly communications: CommunicationsService,
  ) {}

  async log(
    type: SecurityEventType,
    email: string | null,
    context: LoginContext,
    details?: Record<string, unknown>,
  ): Promise<SecurityEvent | null> {
    try {
      const userId =
        typeof details?.userId === 'string' ? details.userId : null;
      return await this.events.save(
        this.events.create({
          type,
          email,
          userId,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          details: details ?? null,
        }),
      );
    } catch {
      // le journal de sécurité ne doit jamais faire échouer l'authentification
      return null;
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
    try {
      if (user.failedLoginCount || user.lockedUntil || user.lastFailedAt) {
        user.failedLoginCount = 0;
        user.lastFailedAt = null;
        user.lockedUntil = null;
        await this.users.save(user);
      }
      const event = await this.log('login_success', user.email, context, {
        userId: user.id,
      });
      await this.detectNewDevice(user, context, event?.id);
    } catch {
      // ne jamais faire échouer la connexion à cause du journal de sécurité
    }
  }

  /**
   * F54 — détecte une connexion depuis un appareil inconnu et prévient le
   * citoyen (notification + événement `new_device_login`).
   */
  private async detectNewDevice(
    user: User,
    context: LoginContext,
    currentEventId?: string | null,
  ): Promise<void> {
    if (!user.id || !user.email || (!context.ip && !context.userAgent)) return;
    // comparaison sur l'email : les anciens événements n'ont pas forcément la colonne userId
    const previous = await this.events.find({
      where: { type: 'login_success', email: user.email },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const known = previous.some(
      (e) =>
        e.id !== currentEventId &&
        e.ip === context.ip &&
        e.userAgent === context.userAgent,
    );
    if (known) return;
    await this.log('new_device_login', user.email, context, {
      userId: user.id,
    });
    try {
      const device =
        context.userAgent && context.userAgent.length > 120
          ? `${context.userAgent.slice(0, 117)}…`
          : (context.userAgent ?? 'Appareil inconnu');
      await this.communications.notify(
        user.id,
        'security',
        'Nouvelle connexion détectée',
        `Nous avons détecté une connexion à votre compte depuis un nouvel appareil (${device}${context.ip ? `, IP ${context.ip}` : ''}). Si c'est bien vous, aucune action n'est requise. Sinon, sécurisez immédiatement votre compte en révoquant cette session depuis votre espace sécurité.`,
        'high',
        {
          entityType: 'security',
          entityId: user.id,
          url: '/auth/sessions',
        },
      );
    } catch {
      // la notification ne doit jamais faire échouer l'authentification
    }
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
