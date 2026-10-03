import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { RbacService } from '../rbac/rbac.service';
import { Service } from '../services/entities/service.entity';
import {
  CreateRequestDto,
  ListRequestsQueryDto,
  UpdateRequestDto,
} from './dto/requests.dto';
import { RequestHistory } from './entities/request-history.entity';
import { Request } from './entities/request.entity';

const AGENT_PERMISSION = 'requests.update';

export type RequestIndicators = {
  pending: number;
  in_progress: number;
  resolved: number;
  rejected: number;
  awaiting: number;
  unassigned: number;
  assignedToMe: number;
};

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private readonly requests: Repository<Request>,
    @InjectRepository(RequestHistory)
    private readonly history: Repository<RequestHistory>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
    private readonly rbac: RbacService,
  ) {}

  private async isAgent(userId: string): Promise<boolean> {
    if (await this.rbac.isSuperAdmin(userId)) return true;
    const permissions = await this.rbac.effectivePermissions(userId);
    return permissions.includes(AGENT_PERMISSION);
  }

  private generateRef(): string {
    return `REQ-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
  }

  private async recordHistory(
    requestId: string,
    status: string,
    createdById: string | null,
    comment?: string | null,
  ): Promise<void> {
    await this.history.save(
      this.history.create({
        requestId,
        status,
        createdById,
        comment: comment ?? null,
      }),
    );
  }

  async create(actorId: string, dto: CreateRequestDto): Promise<Request> {
    if (dto.serviceId) {
      const service = await this.services.findOne({
        where: { id: dto.serviceId },
      });
      if (!service) throw new NotFoundException('Service not found');
    }
    const request = await this.requests.save(
      this.requests.create({
        ref: this.generateRef(),
        title: dto.title.trim(),
        description: dto.description,
        category: dto.category ?? null,
        status: 'pending',
        priority: dto.priority ?? 'normal',
        location: dto.location ?? null,
        serviceId: dto.serviceId ?? null,
        citizenId: actorId,
      }),
    );
    await this.recordHistory(request.id, 'pending', actorId, 'Demande soumise');
    return this.get(actorId, request.id);
  }

  private async paginate(
    query: ListRequestsQueryDto,
    where: Record<string, unknown>,
    relations: Record<string, boolean>,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.requests.findAndCount({
      where,
      relations,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async list(
    actorId: string,
    query: ListRequestsQueryDto,
  ): Promise<{ items: Request[]; total: number; page: number; limit: number }> {
    const filters = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
    };
    if (!(await this.isAgent(actorId))) {
      return this.paginate(
        query,
        { citizenId: actorId, ...filters },
        { citizen: true, history: true },
      );
    }
    return this.paginate(query, filters, {
      citizen: true,
      assignedTo: true,
      history: true,
    });
  }

  async myRequests(
    actorId: string,
    query: ListRequestsQueryDto,
  ): Promise<{ items: Request[]; total: number; page: number; limit: number }> {
    return this.paginate(
      query,
      {
        citizenId: actorId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
      },
      { citizen: true, service: true, history: true },
    );
  }

  async get(actorId: string, id: string): Promise<Request> {
    const request = await this.requests.findOne({
      where: { id },
      relations: {
        citizen: true,
        assignedTo: true,
        service: true,
        history: true,
      },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (!(await this.isAgent(actorId)) && request.citizenId !== actorId) {
      throw new ForbiddenException('You can only read your own requests');
    }
    return request;
  }

  async myHistory(
    actorId: string,
    query: ListRequestsQueryDto,
  ): Promise<{
    items: RequestHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.history.findAndCount({
      where: { request: { citizenId: actorId } },
      relations: { request: true, createdBy: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async indicators(actorId: string): Promise<RequestIndicators> {
    if (!(await this.isAgent(actorId))) {
      throw new ForbiddenException('Only agents can read request indicators');
    }
    const byStatus = async (status: string) =>
      this.requests.count({ where: { status: status as Request['status'] } });
    const [pending, in_progress, resolved, rejected, unassigned, assignedToMe] =
      await Promise.all([
        byStatus('pending'),
        byStatus('in_progress'),
        byStatus('resolved'),
        byStatus('rejected'),
        this.requests.count({
          where: [
            { status: 'pending', assignedToId: IsNull() },
            { status: 'in_progress', assignedToId: IsNull() },
          ],
        }),
        this.requests.count({ where: { assignedToId: actorId } }),
      ]);
    return {
      pending,
      in_progress,
      resolved,
      rejected,
      awaiting: unassigned,
      unassigned,
      assignedToMe,
    };
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateRequestDto,
  ): Promise<Request> {
    if (!(await this.isAgent(actorId))) {
      throw new ForbiddenException('Only agents can update requests');
    }
    const request = await this.requests.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');
    const statusChanged =
      dto.status !== undefined && dto.status !== request.status;
    if (statusChanged) request.status = dto.status as Request['status'];
    if (dto.priority !== undefined) request.priority = dto.priority;
    if (dto.adminNote !== undefined) {
      request.adminNote = dto.adminNote ?? null;
    }
    if (dto.assignedToId !== undefined) {
      if (dto.assignedToId) {
        const agent = await this.users.findOne({
          where: { id: dto.assignedToId },
        });
        if (!agent) throw new NotFoundException('Agent not found');
      }
      request.assignedToId = dto.assignedToId ?? null;
    }
    const saved = await this.requests.save(request);
    if (statusChanged || dto.comment) {
      await this.recordHistory(
        saved.id,
        saved.status,
        actorId,
        dto.comment ?? null,
      );
    }
    return saved;
  }
}
