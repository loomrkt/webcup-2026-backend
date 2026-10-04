import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import {
  CreatePermissionDto,
  CreateRoleDto,
  UpdatePermissionDto,
  UpdateRoleDto,
  // @purge:hierarchy-start
  AssignRoleDto,
  CreateChildUserDto,
  // @purge:hierarchy-end
} from './dto/rbac.dto';
// @purge:hierarchy-start
import { hash } from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../auth/auth.constants';
// @purge:hierarchy-end
import { DEFAULT_PERMISSIONS } from './seed/permissions.seed'; // @purge:seed-import
import { MODULE_PERMISSIONS } from './seed/module-permissions.seed'; // @purge:seed-import
import { TENANT_SERVICE } from './rbac.constants';
import type { TenantService } from './rbac.constants';

// @purge:hierarchy-start
type RbacUser = User &
  Partial<{
    emailVerifiedAt: Date | null;
    totpActive: boolean;
    totpSecret: string | null;
    recoveryCodes: string[] | null;
  }>;
// @purge:hierarchy-end

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionsRepo: Repository<Permission>,
    @InjectRepository(Role)
    private readonly rolesRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRolesRepo: Repository<UserRole>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly config: ConfigService,
    @Inject(TENANT_SERVICE)
    private readonly tenant: TenantService,
  ) {}

  async isSuperAdmin(userId: string): Promise<boolean> {
    const userRoles = await this.userRolesRepo.find({
      where: { userId },
      relations: { role: true },
    });
    return userRoles.some((ur) => ur.role?.isSuperAdmin === true);
  }

  /**
   * A "flat actor" is a top-level user (self-registered, no parent and no
   * creator). Such an actor operates in flat mode: it can see and assign any
   * visible (global/own-org) user or role without subtree constraints. The
   * moment a user is created inside the account tree (has a parent), it
   * becomes a hierarchy actor bounded by subtree containment.
   */
  async isFlatActor(userId: string): Promise<boolean> {
    if (await this.isSuperAdmin(userId)) return false;
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: { id: true, parentId: true, createdById: true },
    });
    return !user || (!user.parentId && !user.createdById);
  }

  async effectivePermissions(userId: string): Promise<string[]> {
    const userRoles = await this.userRolesRepo.find({
      where: { userId },
      relations: { role: { permissions: true } },
    });
    const set = new Set<string>();
    for (const ur of userRoles) {
      for (const p of ur.role?.permissions ?? []) set.add(p.name);
    }
    return [...set];
  }

  async rolesForUser(
    userId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const userRoles = await this.userRolesRepo.find({
      where: { userId },
      relations: { role: true },
    });
    return userRoles.map((ur) => ({
      id: ur.roleId,
      name: ur.role?.name ?? '',
    }));
  }

  // @purge:hierarchy-start
  async effectiveCapabilities(userId: string): Promise<{
    canCreateSubRoles: boolean;
    canCreateSubUsers: boolean;
  }> {
    const userRoles = await this.userRolesRepo.find({ where: { userId } });
    return {
      canCreateSubRoles: userRoles.some((ur) => ur.canCreateSubRoles),
      canCreateSubUsers: userRoles.some((ur) => ur.canCreateSubUsers),
    };
  }

  async getDescendantUserIds(userId: string): Promise<string[]> {
    const users = await this.usersRepo.find({
      select: { id: true, createdById: true },
    });
    const byCreator = new Map<string, string[]>();
    for (const u of users) {
      if (!u.createdById) continue;
      const arr = byCreator.get(u.createdById) ?? [];
      arr.push(u.id);
      byCreator.set(u.createdById, arr);
    }
    const result: string[] = [];
    const stack = [userId];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      for (const child of byCreator.get(current) ?? []) {
        result.push(child);
        stack.push(child);
      }
    }
    return result;
  }

  async getSubtreeRoleIds(userId: string): Promise<string[]> {
    const actorIds = new Set([
      userId,
      ...(await this.getDescendantUserIds(userId)),
    ]);
    const roles = await this.rolesRepo.find({
      select: { id: true, createdById: true },
    });
    return roles
      .filter((r) => r.createdById && actorIds.has(r.createdById))
      .map((r) => r.id);
  }

  async assertCanCreateSubUsers(userId: string): Promise<void> {
    if (await this.isSuperAdmin(userId)) return;
    if (await this.isFlatActor(userId)) return;
    const caps = await this.effectiveCapabilities(userId);
    if (!caps.canCreateSubUsers) {
      throw new ForbiddenException('You are not allowed to create sub-users');
    }
  }

  async assertCanCreateSubRoles(userId: string): Promise<void> {
    if (await this.isSuperAdmin(userId)) return;
    if (await this.isFlatActor(userId)) return;
    const caps = await this.effectiveCapabilities(userId);
    if (!caps.canCreateSubRoles) {
      throw new ForbiddenException('You are not allowed to create sub-roles');
    }
  }
  // @purge:hierarchy-end

  async assertCanGrantPermissions(
    actorId: string,
    permissionIds: string[],
  ): Promise<void> {
    if (permissionIds.length === 0) return;
    if (await this.isSuperAdmin(actorId)) return;
    const permissions = await this.permissionsRepo.find({
      where: { id: In(permissionIds) },
    });
    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('Some permission IDs do not exist');
    }
    const names = permissions.map((p) => p.name);
    const pool = new Set(await this.effectivePermissions(actorId));
    const missing = names.filter((n) => !pool.has(n));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Cannot grant permission(s) you do not have: ${missing.join(', ')}`,
      );
    }
  }

  // @purge:hierarchy-start
  async assertCanAssignRole(
    actorId: string,
    targetUserId: string,
    roleId: string,
  ): Promise<void> {
    if (await this.isSuperAdmin(actorId)) return;
    const role = await this.rolesRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSuperAdmin) {
      throw new ForbiddenException('Cannot assign the superadmin role');
    }
    if (await this.isFlatActor(actorId)) {
      await this.tenant.assertUserAssignable(actorId, targetUserId);
      await this.tenant.assertRoleVisible(actorId, role);
      return;
    }
    const descendants = await this.getDescendantUserIds(actorId);
    if (!descendants.includes(targetUserId)) {
      throw new ForbiddenException('Target user is not in your subtree');
    }
    const subtreeRoleIds = await this.getSubtreeRoleIds(actorId);
    if (!subtreeRoleIds.includes(roleId)) {
      throw new ForbiddenException('Role is not in your subtree');
    }
  }

  async assertCanDelegate(
    actorId: string,
    flags: { canCreateSubRoles: boolean; canCreateSubUsers: boolean },
  ): Promise<void> {
    if (await this.isSuperAdmin(actorId)) return;
    const caps = await this.effectiveCapabilities(actorId);
    if (flags.canCreateSubRoles && !caps.canCreateSubRoles) {
      throw new ForbiddenException(
        'You cannot delegate sub-role creation (you do not have it)',
      );
    }
    if (flags.canCreateSubUsers && !caps.canCreateSubUsers) {
      throw new ForbiddenException(
        'You cannot delegate sub-user creation (you do not have it)',
      );
    }
  }
  // @purge:hierarchy-end

  async listPermissions(): Promise<Permission[]> {
    return this.permissionsRepo.find({ order: { name: 'ASC' } });
  }

  async createPermission(
    actorId: string,
    dto: CreatePermissionDto,
  ): Promise<Permission> {
    const name = dto.name.trim();
    const existing = await this.permissionsRepo.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException(`Permission "${name}" already exists`);
    }
    const permission = await this.permissionsRepo.save(
      this.permissionsRepo.create({
        name,
        description: dto.description ?? null,
      }),
    );

    return permission;
  }

  async updatePermission(
    actorId: string,
    id: string,
    dto: UpdatePermissionDto,
  ): Promise<Permission> {
    const permission = await this.permissionsRepo.findOne({ where: { id } });
    if (!permission) throw new NotFoundException('Permission not found');
    if (dto.name !== undefined && dto.name.trim() !== permission.name) {
      const clash = await this.permissionsRepo.findOne({
        where: { name: dto.name.trim() },
      });
      if (clash) {
        throw new ConflictException(`Permission "${dto.name}" already exists`);
      }
      permission.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      permission.description = dto.description ?? null;
    }
    const saved = await this.permissionsRepo.save(permission);

    return saved;
  }

  async deletePermission(actorId: string, id: string): Promise<void> {
    const permission = await this.permissionsRepo.findOne({ where: { id } });
    if (!permission) throw new NotFoundException('Permission not found');
    await this.permissionsRepo.delete({ id });
  }

  async listRoles(actorId: string): Promise<Role[]> {
    const roles = await this.rolesRepo.find({
      relations: {
        permissions: true,
        // @purge:hierarchy-start
        parent: true,
        // @purge:hierarchy-end
      },
      order: { name: 'ASC' },
    });
    // @purge:tenant-start
    if (this.tenant) return this.tenant.filterRolesVisible(actorId, roles);
    // @purge:tenant-end
    return roles;
  }

  async getRole(actorId: string, id: string): Promise<Role> {
    const role = await this.rolesRepo.findOne({
      where: { id },
      relations: {
        permissions: true,
        // @purge:hierarchy-start
        parent: true,
        createdBy: true,
        // @purge:hierarchy-end
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    // @purge:tenant-start
    if (this.tenant) await this.tenant.assertRoleVisible(actorId, role);
    // @purge:tenant-end
    return role;
  }

  async createRole(actorId: string, dto: CreateRoleDto): Promise<Role> {
    // @purge:hierarchy-start
    await this.assertCanCreateSubRoles(actorId);
    // @purge:hierarchy-end
    await this.assertCanGrantPermissions(actorId, dto.permissionIds);
    const name = dto.name.trim();
    const existing = await this.rolesRepo.findOne({ where: { name } });
    if (existing) throw new ConflictException(`Role "${name}" already exists`);

    // @purge:hierarchy-start
    if (dto.parentId) {
      const parent = await this.rolesRepo.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) throw new NotFoundException('Parent role not found');
      if (!(await this.isFlatActor(actorId))) {
        const subtreeRoleIds = await this.getSubtreeRoleIds(actorId);
        if (!subtreeRoleIds.includes(dto.parentId)) {
          throw new ForbiddenException('Parent role is not in your subtree');
        }
      }
    }
    // @purge:hierarchy-end

    const role = this.rolesRepo.create({
      name,
      description: dto.description ?? null,
      // @purge:hierarchy-start
      parentId: dto.parentId ?? null,
      createdById: actorId,
      // @purge:hierarchy-end
    });
    // @purge:tenant-start
    if (this.tenant) {
      role.organizationId = await this.tenant.roleOrgFor(
        actorId,
        dto.organizationId,
      );
    }
    // @purge:tenant-end
    role.permissions = await this.permissionsRepo.find({
      where: { id: In(dto.permissionIds) },
    });
    const savedRole = await this.rolesRepo.save(role);

    return savedRole;
  }

  async updateRole(
    actorId: string,
    id: string,
    dto: UpdateRoleDto,
  ): Promise<Role> {
    const role = await this.rolesRepo.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    // @purge:tenant-start
    if (this.tenant) await this.tenant.assertRoleVisible(actorId, role);
    // @purge:tenant-end
    // @purge:hierarchy-start
    if (
      !(await this.isSuperAdmin(actorId)) &&
      !(await this.isFlatActor(actorId))
    ) {
      const subtreeRoleIds = await this.getSubtreeRoleIds(actorId);
      if (!subtreeRoleIds.includes(id)) {
        throw new ForbiddenException('Role is not in your subtree');
      }
    }
    // @purge:hierarchy-end

    if (dto.name !== undefined && dto.name.trim() !== role.name) {
      const clash = await this.rolesRepo.findOne({
        where: { name: dto.name.trim() },
      });
      if (clash)
        throw new ConflictException(`Role "${dto.name}" already exists`);
      role.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      role.description = dto.description ?? null;
    }
    // @purge:hierarchy-start
    if (dto.parentId !== undefined) {
      if (
        dto.parentId &&
        !(await this.isSuperAdmin(actorId)) &&
        !(await this.isFlatActor(actorId))
      ) {
        const subtreeRoleIds = await this.getSubtreeRoleIds(actorId);
        if (!subtreeRoleIds.includes(dto.parentId)) {
          throw new ForbiddenException('Parent role is not in your subtree');
        }
      }
      role.parentId = dto.parentId ?? null;
    }
    // @purge:hierarchy-end
    if (dto.permissionIds !== undefined) {
      await this.assertCanGrantPermissions(actorId, dto.permissionIds);
      role.permissions = await this.permissionsRepo.find({
        where: { id: In(dto.permissionIds) },
      });
    }
    const updatedRole = await this.rolesRepo.save(role);

    return updatedRole;
  }

  async deleteRole(actorId: string, id: string): Promise<void> {
    const role = await this.rolesRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSuperAdmin) {
      throw new ForbiddenException('Cannot delete the superadmin role');
    }
    // @purge:tenant-start
    if (this.tenant) await this.tenant.assertRoleVisible(actorId, role);
    // @purge:tenant-end
    // @purge:hierarchy-start
    if (
      !(await this.isSuperAdmin(actorId)) &&
      !(await this.isFlatActor(actorId))
    ) {
      const subtreeRoleIds = await this.getSubtreeRoleIds(actorId);
      if (!subtreeRoleIds.includes(id)) {
        throw new ForbiddenException('Role is not in your subtree');
      }
    }
    // @purge:hierarchy-end
    await this.rolesRepo.delete({ id });
  }

  // @purge:hierarchy-start
  async createChildUser(
    actorId: string,
    dto: CreateChildUserDto,
  ): Promise<User> {
    await this.assertCanCreateSubUsers(actorId);
    const email = dto.email.toLowerCase().trim();
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    for (const roleId of dto.roleIds) {
      const role = await this.rolesRepo.findOne({ where: { id: roleId } });
      if (!role) throw new NotFoundException(`Role ${roleId} not found`);
      if (role.isSuperAdmin) {
        throw new ForbiddenException('Cannot assign the superadmin role');
      }
      if (await this.isFlatActor(actorId)) {
        await this.tenant.assertRoleVisible(actorId, role);
        continue;
      }
      const subtreeRoleIds = await this.getSubtreeRoleIds(actorId);
      if (!subtreeRoleIds.includes(roleId)) {
        throw new ForbiddenException(`Role ${roleId} is not in your subtree`);
      }
    }
    await this.assertCanDelegate(actorId, {
      canCreateSubRoles: dto.canCreateSubRoles ?? false,
      canCreateSubUsers: dto.canCreateSubUsers ?? false,
    });

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    const user = this.usersRepo.create({
      email,
      passwordHash,
      createdById: actorId,
      parentId: actorId,
    }) as RbacUser;
    // @purge:tenant-start
    if (this.tenant) await this.tenant.applyChildOrg(actorId, user);
    // @purge:tenant-end
    // Admin vouches for the child — mark verified when the column exists
    if (
      (
        this.config.get<string>('AUTH_REQUIRE_EMAIL_VERIFICATION') ?? 'true'
      ).toLowerCase() === 'true'
    ) {
      user.emailVerifiedAt = new Date();
    }
    const saved = await this.usersRepo.save(user);
    for (const roleId of dto.roleIds) {
      await this.userRolesRepo.save(
        this.userRolesRepo.create({
          userId: saved.id,
          roleId,
          canCreateSubRoles: dto.canCreateSubRoles ?? false,
          canCreateSubUsers: dto.canCreateSubUsers ?? false,
        }),
      );
    }

    return saved;
  }

  async assignRoleToUser(
    actorId: string,
    targetUserId: string,
    dto: AssignRoleDto,
  ): Promise<UserRole> {
    await this.assertCanAssignRole(actorId, targetUserId, dto.roleId);
    // @purge:tenant-start
    if (this.tenant) {
      await this.tenant.assertUserAssignable(actorId, targetUserId);
    }
    // @purge:tenant-end
    await this.assertCanDelegate(actorId, {
      canCreateSubRoles: dto.canCreateSubRoles ?? false,
      canCreateSubUsers: dto.canCreateSubUsers ?? false,
    });
    const existing = await this.userRolesRepo.findOne({
      where: { userId: targetUserId, roleId: dto.roleId },
    });
    const assignment = existing
      ? await this.userRolesRepo.save(existing)
      : await this.userRolesRepo.save(
          this.userRolesRepo.create({
            userId: targetUserId,
            roleId: dto.roleId,
            canCreateSubRoles: dto.canCreateSubRoles ?? false,
            canCreateSubUsers: dto.canCreateSubUsers ?? false,
          }),
        );

    return assignment;
  }

  async listDescendantUsers(actorId: string): Promise<User[]> {
    const descendants = await this.getDescendantUserIds(actorId);
    if (descendants.length === 0) return [];
    return this.usersRepo.find({
      where: { id: In(descendants) },
      relations: { userRoles: { role: true } },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Adaptive user visibility (no mode to configure):
   * - superadmin → every user;
   * - otherwise → descendants (account tree) ∪ users of the same
   *   organization (`null === null` counts as equal → with no organizations
   *   created, every user is visible, i.e. flat behaviour; once orgs are
   *   used, listing is scoped to the actor's org).
   */
  async listVisibleUsers(actorId: string): Promise<User[]> {
    if (await this.isSuperAdmin(actorId)) {
      return this.usersRepo.find({
        relations: { userRoles: { role: true } },
        order: { createdAt: 'ASC' },
      });
    }
    const descendants = new Set(await this.getDescendantUserIds(actorId));
    const org = await this.tenant.myOrg(actorId);
    const users = await this.usersRepo.find({
      relations: { userRoles: { role: true } },
      order: { createdAt: 'ASC' },
    });
    return users.filter(
      (u) => descendants.has(u.id) || u.organizationId === org,
    );
  }
  // @purge:hierarchy-end

  private boolEnv(key: string, def: boolean): boolean {
    return (
      (this.config.get<string>(key) ?? String(def)).toLowerCase() === 'true'
    );
  }

  async seedIfNeeded(): Promise<void> {
    if (!this.boolEnv('RBAC_DEFAULT_ADMIN_ROLE', true)) return;
    await this.ensureAdminRole();
    // @purge:seed-start
    if (this.boolEnv('RBAC_SEED_PERMISSIONS', true)) {
      await this.seedPermissions();
    }
    // @purge:seed-end
    if (this.boolEnv('RBAC_SEED_DEFAULT_ROLES', true)) {
      await this.ensureDefaultRoles();
    }
  }

  async assignDefaultAdminIfFirstUser(userId: string): Promise<void> {
    if (!this.boolEnv('RBAC_DEFAULT_ADMIN_ROLE', true)) return;
    const email = (
      this.config.get<string>('RBAC_DEFAULT_ADMIN_EMAIL') ?? ''
    ).trim();
    if (email) {
      const user = await this.usersRepo.findOne({ where: { id: userId } });
      if (!user || user.email.toLowerCase() !== email.toLowerCase()) return;
    } else {
      const count = await this.usersRepo.count();
      if (count !== 1) return;
    }
    const role = await this.ensureAdminRole();
    const existing = await this.userRolesRepo.findOne({
      where: { userId, roleId: role.id },
    });
    if (existing) return;
    await this.userRolesRepo.save(
      this.userRolesRepo.create({
        userId,
        roleId: role.id,
        // @purge:hierarchy-start
        canCreateSubRoles: true,
        canCreateSubUsers: true,
        // @purge:hierarchy-end
      }),
    );
  }

  private async ensureAdminRole(): Promise<Role> {
    let role = await this.rolesRepo.findOne({ where: { name: 'admin' } });
    if (!role) {
      role = this.rolesRepo.create({
        name: 'admin',
        description: 'Super admin — full access, bypasses all RBAC checks',
        isSuperAdmin: true,
      });
      role = await this.rolesRepo.save(role);
    }
    return role;
  }

  async assignDefaultCitizenRoleIfMissing(userId: string): Promise<void> {
    if (!this.boolEnv('RBAC_SEED_DEFAULT_ROLES', true)) return;
    if (await this.isSuperAdmin(userId)) return;
    const role = await this.rolesRepo.findOne({ where: { name: 'citoyen' } });
    if (!role) return;
    const existing = await this.userRolesRepo.findOne({
      where: { userId, roleId: role.id },
    });
    if (existing) return;
    await this.userRolesRepo.save(
      this.userRolesRepo.create({ userId, roleId: role.id }),
    );
  }

  private async ensureDefaultRoles(): Promise<void> {
    const definitions: Array<{
      name: string;
      description: string;
      permissions: string[];
    }> = [
      {
        name: 'citoyen',
        description: 'Citizen — standard platform user',
        permissions: [
          'requests.create',
          'requests.read',
          'requests.support',
          'participation.concerns.create',
          'participation.concerns.read',
          'privacy.export',
          'consultations.respond',
          'feedback.read',
          'feedback.create',
          'ideas.read',
          'ideas.create',
          'notifications.read',
          'notifications.update',
          'guides.read',
          'appointments.read',
          'appointments.create',
        ],
      },
      {
        name: 'agent_municipal',
        description: 'Municipal agent — handles citizen requests and content',
        permissions: [
          'services.read',
          'news.read',
          'contact.read',
          'contact.update',
          'requests.read',
          'requests.update',
          'participation.concerns.read',
          'participation.concerns.update',
          'projects.manage',
          'consultations.manage',
          'feedback.manage',
          'ideas.manage',
          'dashboard.read',
          'nova-terra.read',
          'i18n.read',
          'i18n.manage',
          'announcements.read',
          'announcements.create',
          'announcements.update',
          'announcements.delete',
          'alerts.read',
          'alerts.create',
          'alerts.update',
          'alerts.delete',
          'notifications.read',
          'notifications.update',
          'accounts.read',
          'accounts.update',
          'accounts.delete',
          'rbac.users.read',
          'guides.read',
          'guides.manage',
          'mobility.read',
          'mobility.create',
          'mobility.update',
          'mobility.delete',
          'security.read',
          'appointments.read',
          'appointments.create',
          'appointments.manage',
          'places.manage',
          'glossary.manage',
          'audit.read',
        ],
      },
    ];
    for (const def of definitions) {
      let role = await this.rolesRepo.findOne({
        where: { name: def.name },
        relations: { permissions: true },
      });
      if (!role) {
        role = this.rolesRepo.create({
          name: def.name,
          description: def.description,
        });
        role = await this.rolesRepo.save(role);
      }
      const perms = await this.permissionsRepo.find({
        where: { name: In(def.permissions) },
      });
      const same =
        role.permissions?.length === perms.length &&
        role.permissions.every((p) => perms.some((q) => q.id === p.id));
      if (!same) {
        role.permissions = perms;
        await this.rolesRepo.save(role);
      }
    }
  }

  // @purge:seed-start
  private async seedPermissions(): Promise<void> {
    // default catalogue + permissions contributed by selected modules
    const all = [...DEFAULT_PERMISSIONS, ...MODULE_PERMISSIONS];
    const existing = await this.permissionsRepo.find({
      select: { name: true },
    });
    const names = new Set(existing.map((p) => p.name));
    const missing = all.filter((p) => !names.has(p.name));
    if (missing.length > 0) {
      await this.permissionsRepo.save(this.permissionsRepo.create(missing));
    }
  }
  // @purge:seed-end
}
