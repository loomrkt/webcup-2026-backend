import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { Service } from '../services/entities/service.entity';
import {
  CreateRequestDto,
  ListRequestsQueryDto,
  UpdateRequestDto,
} from './dto/requests.dto';
import { RequestHistory } from './entities/request-history.entity';
import { Request } from './entities/request.entity';

const AGENT_PERMISSION = 'requests.update';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Déposée',
  in_progress: 'En cours de traitement',
  resolved: 'Traitée',
  rejected: 'Clôturée',
};

const STATUS_ACTIONS: Record<string, string> = {
  pending: 'Votre demande a bien été enregistrée.',
  in_progress:
    'Aucune action n’est requise de votre part pour le moment. Vous serez recontacté·e si nécessaire.',
  resolved:
    'La solution apportée est disponible. Vous pouvez consulter le suivi de votre demande.',
  rejected:
    'La demande a été clôturée. Vous pouvez la consulter pour comprendre les raisons ou déposer une nouvelle demande.',
};

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
  private readonly logger = new Logger(RequestsService.name);

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
    private readonly audit: AuditService,
    private readonly communications: CommunicationsService,
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
    const title = dto.title.trim();
    const recent = await this.requests.findOne({
      where: {
        citizenId: actorId,
        title,
        createdAt: MoreThanOrEqual(new Date(Date.now() - 2 * 60_000)),
      },
    });
    if (recent) {
      throw new ConflictException(
        'Une demande similaire vient d’être envoyée. Suivez sa progression dans votre espace au lieu de la renvoyer.',
      );
    }
    const request = await this.requests.save(
      this.requests.create({
        ref: this.generateRef(),
        title,
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

  /** F56 — récapitulatif téléchargeable des demandes personnelles. */
  async myRequestsSummary(userId: string): Promise<Request[]> {
    return this.requests.find({
      where: { citizenId: userId },
      relations: { history: true, service: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** F88 — récapitulatif téléchargeable de toutes les demandes (agents). */
  async allRequestsSummary(): Promise<Request[]> {
    return this.requests.find({
      relations: { history: true, service: true },
      order: { createdAt: 'DESC' },
    });
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
    const newComment = dto.comment ?? null;
    if (statusChanged || dto.comment) {
      await this.recordHistory(saved.id, saved.status, actorId, newComment);
    }
    if (statusChanged) {
      await this.notifyStatusChange(saved, newComment);
    }
    await this.audit.log({
      actorId,
      action: 'update',
      entityType: 'request',
      entityId: saved.id,
      summary: `Mise à jour de la demande ${saved.ref} (statut : ${saved.status})`,
      after: { status: saved.status, priority: saved.priority },
    });
    return saved;
  }

  /** F49 — prévient le citoyen quand sa demande change d'état. */
  private async notifyStatusChange(
    request: Request,
    comment: string | null,
  ): Promise<void> {
    if (!request.citizenId) return;
    const label = STATUS_LABELS[request.status] ?? request.status;
    const action = STATUS_ACTIONS[request.status] ?? '';
    const bodyParts = [
      `Votre demande ${request.ref} est passée au statut « ${label} ».`,
      action,
    ];
    if (comment) bodyParts.push(`Message de la municipalité : ${comment}`);
    try {
      await this.communications.notify(
        request.citizenId,
        'request',
        `Votre demande ${request.ref} : ${label}`,
        bodyParts.join(' '),
        request.status === 'resolved' ? 'high' : 'normal',
        {
          entityType: 'request',
          entityId: request.id,
          url: `/requests/${request.id}`,
          ref: request.ref,
          status: request.status,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to notify citizen ${request.citizenId} of request ${request.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
