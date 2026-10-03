import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { ContactMessage } from '../contact/entities/contact-message.entity';
import { Publication } from '../news/entities/publication.entity';
import { Request, REQUEST_STATUSES } from '../requests/entities/request.entity';
import { Service } from '../services/entities/service.entity';

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
    return {
      totalUsers,
      activeServices,
      publishedPublications,
      newContactMessages,
      totalRequests,
      requestsByStatus,
      recentRequests,
      latestContactMessages,
    };
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
