import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import {
  CreateOrganizationDto,
  SetUserOrgDto,
  UpdateOrganizationDto,
} from './dto/rbac.dto';
import { Organization } from './entities/organization.entity';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationsRepo: Repository<Organization>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRolesRepo: Repository<UserRole>,
  ) {}

  private async isSuperAdmin(userId: string): Promise<boolean> {
    const userRoles = await this.userRolesRepo.find({
      where: { userId },
      relations: { role: true },
    });
    return userRoles.some((ur) => ur.role?.isSuperAdmin === true);
  }

  async myOrg(userId: string): Promise<string | null> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    return user?.organizationId ?? null;
  }

  async roleOrgFor(
    actorId: string,
    requestedOrgId?: string | null,
  ): Promise<string | null> {
    if (await this.isSuperAdmin(actorId)) return requestedOrgId ?? null;
    return this.myOrg(actorId);
  }

  async filterRolesVisible(actorId: string, roles: Role[]): Promise<Role[]> {
    if (await this.isSuperAdmin(actorId)) return roles;
    const org = await this.myOrg(actorId);
    return roles.filter(
      (r) => r.organizationId === null || r.organizationId === org,
    );
  }

  async assertRoleVisible(actorId: string, role: Role): Promise<void> {
    if (await this.isSuperAdmin(actorId)) return;
    const org = await this.myOrg(actorId);
    const visible = role.organizationId === null || role.organizationId === org;
    if (!visible) {
      throw new ForbiddenException('Role is not in your organization');
    }
  }

  async assertUserAssignable(
    actorId: string,
    targetUserId: string,
  ): Promise<void> {
    if (await this.isSuperAdmin(actorId)) return;
    const actorOrg = await this.myOrg(actorId);
    const target = await this.usersRepo.findOne({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!actorOrg && !target.organizationId) return;
    if (actorOrg && actorOrg === target.organizationId) return;
    throw new ForbiddenException('User is not in your organization');
  }

  async applyChildOrg(actorId: string, user: User): Promise<void> {
    if (await this.isSuperAdmin(actorId)) return;
    user.organizationId = await this.myOrg(actorId);
  }

  async listVisibleOrganizations(actorId: string): Promise<Organization[]> {
    if (await this.isSuperAdmin(actorId)) {
      return this.organizationsRepo.find({ order: { name: 'ASC' } });
    }
    const orgId = await this.myOrg(actorId);
    if (!orgId) return [];
    const org = await this.organizationsRepo.findOne({
      where: { id: orgId },
    });
    return org ? [org] : [];
  }

  async createOrganization(dto: CreateOrganizationDto): Promise<Organization> {
    return this.organizationsRepo.save(
      this.organizationsRepo.create({
        name: dto.name.trim(),
        slug: dto.slug.trim().toLowerCase(),
      }),
    );
  }

  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    const org = await this.organizationsRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    if (dto.name !== undefined) org.name = dto.name.trim();
    if (dto.slug !== undefined) org.slug = dto.slug.trim().toLowerCase();
    return this.organizationsRepo.save(org);
  }

  async deleteOrganization(id: string): Promise<void> {
    const org = await this.organizationsRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    await this.organizationsRepo.delete({ id });
  }

  async setUserOrg(userId: string, dto: SetUserOrgDto): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const organizationId = dto.organizationId ?? null;
    if (organizationId) {
      const org = await this.organizationsRepo.findOne({
        where: { id: organizationId },
      });
      if (!org) throw new NotFoundException('Organization not found');
    }
    user.organizationId = organizationId;
    return this.usersRepo.save(user);
  }
}
