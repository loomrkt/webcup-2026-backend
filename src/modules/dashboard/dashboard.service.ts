import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { ContactMessage } from '../contact/entities/contact-message.entity';
import { Publication } from '../news/entities/publication.entity';
import { Request, REQUEST_STATUSES } from '../requests/entities/request.entity';
import { RequestHistory } from '../requests/entities/request-history.entity';
import { Service } from '../services/entities/service.entity';

const ACTIVITY_DAYS = 14;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
    @InjectRepository(Publication)
    private readonly publications: Repository<Publication>,
    @InjectRepository(ContactMessage)
    private readonly contacts: Repository<ContactMessage>,
    @InjectRepository(Request)
    private readonly requests: Repository<Request>,
    @InjectRepository(RequestHistory)
    private readonly history: Repository<RequestHistory>,
    private readonly config: ConfigService,
  ) {}

  async stats() {
    const totalUsers = await this.users.count();
    const activeServices = await this.services.count({
      where: { active: true },
    });
    const publishedPublications = await this.publications.count({
      where: { published: true },
    });
    const newContactMessages = await this.contacts.count({
      where: { status: 'new' },
    });
    const requestsByStatus: Record<string, number> = {};
    for (const status of REQUEST_STATUSES) {
      requestsByStatus[status] = await this.requests.count({
        where: { status },
      });
    }
    const totalRequests = await this.requests.count();
    const recentRequests = await this.requests.find({
      relations: { citizen: true },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    const latestContactMessages = await this.contacts.find({
      order: { createdAt: 'DESC' },
      take: 5,
    });
    const recentActivity = await this.history.find({
      relations: { request: true, createdBy: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return {
      totalUsers,
      activeServices,
      publishedPublications,
      newContactMessages,
      totalRequests,
      requestsByStatus,
      requestsByDay: await this.requestsByDay(),
      recentRequests,
      recentActivity,
      latestContactMessages,
    };
  }

  /** F50 — évolution de l'activité : demandes déposées par jour (14 derniers jours). */
  private async requestsByDay(): Promise<
    Array<{ day: string; count: number }>
  > {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (ACTIVITY_DAYS - 1));
    const rows = await this.requests
      .createQueryBuilder('request')
      .select("to_char(request.created_at, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .where('request.created_at >= :since', { since })
      .groupBy("to_char(request.created_at, 'YYYY-MM-DD')")
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; count: string }>();
    const counts = new Map(rows.map((r) => [r.day, Number(r.count)]));
    const result: Array<{ day: string; count: number }> = [];
    for (let i = 0; i < ACTIVITY_DAYS; i++) {
      const day = new Date(since);
      day.setDate(since.getDate() + i);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      result.push({ day: key, count: counts.get(key) ?? 0 });
    }
    return result;
  }

  async novaTerra() {
    const baseUrl = this.config.get<string>('NOVA_TERRA_API_URL')?.trim();
    if (!baseUrl) {
      return {
        source: 'local',
        status: 'unconfigured',
        message: 'NOVA_TERRA_API_URL is not set — returning local data',
        data: await this.stats(),
      };
    }
    try {
      const res = await fetch(baseUrl, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        throw new Error(`Nova Terra API responded ${res.status}`);
      }
      return {
        source: 'nova-terra',
        status: 'ok',
        data: (await res.json()) as unknown,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        source: 'local',
        status: 'error',
        message: `Nova Terra API unreachable (${message}) — falling back to local data`,
        data: await this.stats(),
      };
    }
  }
}
