import type { Role } from './entities/role.entity';
import type { User } from '../auth/entities/user.entity';
import type { Organization } from './entities/organization.entity';

export const TENANT_SERVICE = 'TENANT_SERVICE';

export interface TenantService {
  myOrg(userId: string): Promise<string | null>;
  roleOrgFor(
    actorId: string,
    requestedOrgId?: string | null,
  ): Promise<string | null>;
  filterRolesVisible(actorId: string, roles: Role[]): Promise<Role[]>;
  assertRoleVisible(actorId: string, role: Role): Promise<void>;
  assertUserAssignable(actorId: string, targetUserId: string): Promise<void>;
  applyChildOrg(actorId: string, user: User): Promise<void>;
  listVisibleOrganizations(actorId: string): Promise<Organization[]>;
}
