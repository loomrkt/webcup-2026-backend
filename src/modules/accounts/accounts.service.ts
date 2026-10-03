import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare } from 'bcryptjs';
import { IsNull, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { AuditService } from '../audit/audit.service';
import {
  DeleteAccountDto,
  DeleteOwnAccountDto,
  ListAccountsQueryDto,
  UpdateAccountDto,
} from './dto/accounts.dto';

const DELETED_EMAIL_DOMAIN = 'deleted.novaterra.fr';

export interface AccountList {
  items: User[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly audit: AuditService,
  ) {}

  // ─── Suppression par le citoyen (F33) ──────────────────────────────────────

  async deleteOwnAccount(
    userId: string,
    dto: DeleteOwnAccountDto,
  ): Promise<void> {
    if (dto.confirm !== true) {
      throw new BadRequestException(
        'You must explicitly confirm the account deletion',
      );
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt) {
      throw new BadRequestException('Account is already deleted');
    }
    await this.verifyIdentity(user, dto);
    await this.anonymizeAccount(user);
  }

  private async verifyIdentity(
    user: User,
    dto: DeleteOwnAccountDto,
  ): Promise<void> {
    if (user.passwordHash) {
      if (!dto.password) {
        throw new BadRequestException(
          'Password is required to delete the account',
        );
      }
      const ok = await compare(dto.password, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Invalid password');
      return;
    }
    if (!dto.email) {
      throw new BadRequestException(
        'Email is required to delete the account (no password set)',
      );
    }
    if (dto.email.toLowerCase().trim() !== user.email.toLowerCase()) {
      throw new UnauthorizedException('Invalid email');
    }
  }

  private async anonymizeAccount(user: User): Promise<void> {
    const originalEmail = user.email;
    user.email = `deleted-${user.id.slice(0, 8)}@${DELETED_EMAIL_DOMAIN}`;
    user.firstName = null;
    user.lastName = null;
    user.phone = null;
    user.address = null;
    user.city = null;
    user.birthDate = null;
    user.passwordHash = null;
    user.totpSecret = null;
    user.totpActive = false;
    user.recoveryCodes = null;
    user.emailVerifiedAt = null;
    user.deletedAt = new Date();
    user.status = 'deleted';
    await this.users.save(user);
    await this.refreshTokens.delete({ userId: user.id });
    await this.audit.log({
      actorId: user.id,
      actorEmail: originalEmail,
      action: 'delete',
      entityType: 'account',
      entityId: user.id,
      summary: `Suppression du compte (${originalEmail})`,
    });
  }

  // ─── Administration des comptes (F34) ─────────────────────────────────────

  async list(query: ListAccountsQueryDto): Promise<AccountList> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.users.createQueryBuilder('user');
    if (query.q) {
      qb.where(
        '(user.email ILIKE :q OR user.firstName ILIKE :q OR user.lastName ILIKE :q OR user.city ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    }
    if (query.status === 'deleted') {
      qb.andWhere('user.deletedAt IS NOT NULL');
    } else if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    } else {
      qb.andWhere('user.deletedAt IS NULL');
    }
    qb.orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async get(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Account not found');
    return user;
  }

  async update(id: string, dto: UpdateAccountDto): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Account not found');
    if (user.deletedAt) {
      throw new BadRequestException('Cannot update a deleted account');
    }
    const before = {
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    if (dto.status !== undefined) {
      if (user.status === 'deleted') {
        throw new BadRequestException(
          'Cannot change the status of a deleted account',
        );
      }
      user.status = dto.status;
    }
    if (dto.firstName !== undefined) user.firstName = dto.firstName ?? null;
    if (dto.lastName !== undefined) user.lastName = dto.lastName ?? null;
    const saved = await this.users.save(user);
    await this.audit.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'update',
      entityType: 'account',
      entityId: user.id,
      summary: `Mise à jour du compte (statut : ${before.status} → ${saved.status})`,
      before,
      after: {
        status: saved.status,
        firstName: saved.firstName,
        lastName: saved.lastName,
      },
    });
    return saved;
  }

  async delete(id: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Account not found');
    if (dto.permanent === true) {
      await this.users.delete({ id });
      await this.audit.log({
        action: 'delete',
        entityType: 'account',
        entityId: id,
        summary: `Suppression physique du compte ${user.email}`,
      });
      return;
    }
    if (user.deletedAt) {
      throw new BadRequestException('Account is already deleted');
    }
    await this.anonymizeAccount(user);
  }

  /** Annule la suppression : restaure un email temporaire et réactive le compte. */
  async restore(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Account not found');
    if (!user.deletedAt) {
      throw new BadRequestException('Account is not deleted');
    }
    const original = user.email;
    user.email = `restored-${user.id.slice(0, 8)}@${DELETED_EMAIL_DOMAIN}`;
    user.deletedAt = null;
    user.status = 'active';
    const saved = await this.users.save(user);
    await this.audit.log({
      actorId: user.id,
      actorEmail: original,
      action: 'restore',
      entityType: 'account',
      entityId: user.id,
      summary: `Restauration du compte ${original}`,
    });
    return saved;
  }

  /** Retourne le nombre de comptes actifs (indicateurs dashboard). */
  async activeCount(): Promise<number> {
    return this.users.count({
      where: { deletedAt: IsNull(), status: 'active' },
    });
  }
}
