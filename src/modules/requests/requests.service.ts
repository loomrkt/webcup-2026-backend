import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { RbacService } from '../rbac/rbac.service';
import {
  CreateRequestDto,
  ListRequestsQueryDto,
  UpdateRequestDto,
} from './dto/requests.dto';
import { Request } from './entities/request.entity';

const AGENT_PERMISSION = 'requests.update';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private readonly requests: Repository<Request>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly rbac: RbacService,
  ) {}

  private async isAgent(userId: string): Promise<boolean> {
    if (await this.rbac.isSuperAdmin(userId)) return true;
    const permissions = await this.rbac.effectivePermissions(userId);
    return permissions.includes(AGENT_PERMISSION);
  }

  async create(actorId: string, dto: CreateRequestDto): Promise<Request> {
    return this.requests.save(
      this.requests.create({
        ref: `REQ-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`,
        title: dto.title.trim(),
        description: dto.description,
        category: dto.category ?? null,
        status: 'pending',
        priority: dto.priority ?? 'normal',
        citizenId: actorId,
      }),
    );
  }

  async list(actorId: string, query: ListRequestsQueryDto): Promise<Request[]> {
    if (!(await this.isAgent(actorId))) {
      return this.requests.find({
        where: {
          citizenId: actorId,
          ...(query.status ? { status: query.status } : {}),
          ...(query.priority ? { priority: query.priority } : {}),
        },
        relations: { citizen: true },
        order: { createdAt: 'DESC' },
      });
    }
    return this.requests.find({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
      },
      relations: { citizen: true, assignedTo: true },
      order: { createdAt: 'DESC' },
    });
  }

  async get(actorId: string, id: string): Promise<Request> {
    const request = await this.requests.findOne({
      where: { id },
      relations: { citizen: true, assignedTo: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (!(await this.isAgent(actorId)) && request.citizenId !== actorId) {
      throw new ForbiddenException('You can only read your own requests');
    }
    return request;
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
    if (dto.status !== undefined) request.status = dto.status;
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
    return this.requests.save(request);
  }
}
