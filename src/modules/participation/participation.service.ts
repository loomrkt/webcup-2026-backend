import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CommunicationsService } from '../communications/communications.service';
import { RbacService } from '../rbac/rbac.service';
import { Request } from '../requests/entities/request.entity';
import {
  CreateDataConcernDto,
  ListDataConcernsQueryDto,
  UpdateDataConcernDto,
} from './dto/participation.dto';
import { DataConcern } from './entities/data-concern.entity';
import { RequestSupport } from './entities/request-support.entity';

const AGENT_PERMISSION = 'participation.concerns.update';

export interface SupportStatus {
  count: number;
  supportedByMe: boolean;
}

@Injectable()
export class ParticipationService {
  private readonly logger = new Logger(ParticipationService.name);

  constructor(
    @InjectRepository(DataConcern)
    private readonly concerns: Repository<DataConcern>,
    @InjectRepository(RequestSupport)
    private readonly supports: Repository<RequestSupport>,
    @InjectRepository(Request)
    private readonly requests: Repository<Request>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly rbac: RbacService,
    private readonly communications: CommunicationsService,
  ) {}

  private async isAgent(userId: string): Promise<boolean> {
    if (await this.rbac.isSuperAdmin(userId)) return true;
    const permissions = await this.rbac.effectivePermissions(userId);
    return permissions.includes(AGENT_PERMISSION);
  }

  // ─── F51 : remontée des préoccupations données ────────────────────────────

  async submitConcern(
    actorId: string,
    dto: CreateDataConcernDto,
  ): Promise<DataConcern> {
    const concern = await this.concerns.save(
      this.concerns.create({
        userId: actorId,
        category: dto.category ?? null,
        message: dto.message.trim(),
        status: 'new',
      }),
    );
    try {
      await this.communications.notify(
        actorId,
        'system',
        'Préoccupation enregistrée',
        'Merci ! Votre contribution a bien été prise en compte. Vous pourrez suivre son traitement depuis votre espace citoyen.',
        'normal',
        {
          entityType: 'data-concern',
          entityId: concern.id,
          url: `/participation/concerns/${concern.id}`,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to notify concern ${concern.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
    return this.getConcern(actorId, concern.id);
  }

  async myConcerns(
    actorId: string,
    query: ListDataConcernsQueryDto,
  ): Promise<{
    items: DataConcern[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.paginate(query, { userId: actorId });
  }

  async listConcerns(
    actorId: string,
    query: ListDataConcernsQueryDto,
  ): Promise<{
    items: DataConcern[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (!(await this.isAgent(actorId))) {
      throw new ForbiddenException('Only agents can list all concerns');
    }
    return this.paginate(query, {});
  }

  private async paginate(
    query: ListDataConcernsQueryDto,
    where: Record<string, unknown>,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = {
      ...where,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.concerns.findAndCount({
      where: filters,
      relations: { user: true, respondedBy: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async getConcern(actorId: string, id: string): Promise<DataConcern> {
    const concern = await this.concerns.findOne({
      where: { id },
      relations: { user: true, respondedBy: true },
    });
    if (!concern) throw new NotFoundException('Concern not found');
    if (!(await this.isAgent(actorId)) && concern.userId !== actorId) {
      throw new ForbiddenException('You can only read your own concerns');
    }
    return concern;
  }

  async updateConcern(
    actorId: string,
    id: string,
    dto: UpdateDataConcernDto,
  ): Promise<DataConcern> {
    if (!(await this.isAgent(actorId))) {
      throw new ForbiddenException('Only agents can update concerns');
    }
    const concern = await this.concerns.findOne({ where: { id } });
    if (!concern) throw new NotFoundException('Concern not found');
    const statusChanged =
      dto.status !== undefined && dto.status !== concern.status;
    if (statusChanged) concern.status = dto.status as DataConcern['status'];
    if (dto.response !== undefined) {
      concern.response = dto.response ?? null;
      concern.respondedById = dto.response ? actorId : null;
    }
    const saved = await this.concerns.save(concern);
    if (statusChanged || dto.response) {
      try {
        await this.communications.notify(
          saved.userId,
          'system',
          `Votre préoccupation : ${saved.status === 'answered' ? 'réponse disponible' : 'prise en compte'}`,
          `La municipalité a mis à jour votre contribution concernant l'utilisation des données. Consultez son suivi pour le détail.`,
          'normal',
          {
            entityType: 'data-concern',
            entityId: saved.id,
            url: `/participation/concerns/${saved.id}`,
          },
        );
      } catch (error) {
        this.logger.warn(
          `Failed to notify concern update ${saved.id}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }
    return this.getConcern(actorId, saved.id);
  }

  // ─── F52 : soutien d'une demande ──────────────────────────────────────────

  async supportRequest(
    actorId: string,
    requestId: string,
  ): Promise<SupportStatus> {
    const request = await this.requests.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    const existing = await this.supports.findOne({
      where: { requestId, userId: actorId },
    });
    if (existing) {
      throw new ConflictException('You already support this request');
    }
    try {
      await this.supports.save(
        this.supports.create({ requestId, userId: actorId }),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('uq_request_support')
      ) {
        throw new ConflictException('You already support this request');
      }
      throw error;
    }
    return this.supportStatus(actorId, requestId);
  }

  async withdrawSupport(
    actorId: string,
    requestId: string,
  ): Promise<SupportStatus> {
    const request = await this.requests.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    await this.supports.delete({ requestId, userId: actorId });
    return this.supportStatus(actorId, requestId);
  }

  async supportStatus(
    actorId: string,
    requestId: string,
  ): Promise<SupportStatus> {
    const request = await this.requests.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    const [count, mine] = await Promise.all([
      this.supports.count({ where: { requestId } }),
      this.supports.count({ where: { requestId, userId: actorId } }),
    ]);
    return { count, supportedByMe: mine > 0 };
  }
}
