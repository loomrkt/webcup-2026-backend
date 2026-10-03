import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, Repository } from 'typeorm';
import { ListAuditQueryDto } from './dto/audit.dto';
import { AuditEvent } from './entities/audit-event.entity';

export interface AuditLogEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
}

export interface AuditList {
  items: AuditEvent[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly events: Repository<AuditEvent>,
  ) {}

  /** Enregistre une action (fire-and-forget, ne bloque jamais le flux métier). */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.events.save(
        this.events.create({
          actorId: entry.actorId ?? null,
          actorEmail: entry.actorEmail ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          summary: entry.summary ?? null,
          before: entry.before ?? null,
          after: entry.after ?? null,
          ip: entry.ip ?? null,
        }),
      );
    } catch {
      // l'audit ne doit jamais faire échouer l'action métier
    }
  }

  async list(query: ListAuditQueryDto): Promise<AuditList> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Record<string, unknown> = {};
    if (query.q) {
      where.summary = ILike(`%${query.q.trim()}%`);
    }
    if (query.actorId) where.actorId = query.actorId;
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = query.action;
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

  async distinctEntityTypes(): Promise<string[]> {
    const rows = await this.events
      .createQueryBuilder('event')
      .select('DISTINCT event.entityType', 'type')
      .orderBy('event.entityType')
      .getRawMany();
    return rows.map((r) => {
      const value = (r as { type?: unknown }).type;
      return typeof value === 'string' ? value : '';
    });
  }
}
