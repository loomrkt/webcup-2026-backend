import { ForbiddenException } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { Permission } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';
import { User } from '../auth/entities/user.entity';

jest.mock('@nestjs/config', () => ({
  ConfigService: class {},
}));

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

function makeRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

describe('RbacService', () => {
  let service: RbacService;
  const permissionsRepo = makeRepo();
  const rolesRepo = makeRepo();
  const userRolesRepo = makeRepo();
  const usersRepo = makeRepo();
  const config = { get: jest.fn() };
  const tenant = {
    myOrg: jest.fn(),
    roleOrgFor: jest.fn(),
    filterRolesVisible: jest.fn(),
    assertRoleVisible: jest.fn(),
    assertUserAssignable: jest.fn(),
    applyChildOrg: jest.fn(),
    listVisibleOrganizations: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('true');
    tenant.myOrg.mockResolvedValue(null);
    tenant.assertRoleVisible.mockResolvedValue(undefined);
    tenant.assertUserAssignable.mockResolvedValue(undefined);
    service = new RbacService(
      permissionsRepo as never,
      rolesRepo as never,
      userRolesRepo as never,
      usersRepo as never,
      config as never,
      tenant,
    );
  });

  describe('effectivePermissions', () => {
    it('unions permissions across all assigned roles', async () => {
      userRolesRepo.find.mockResolvedValue([
        {
          role: {
            permissions: [
              { name: 'sales.tickets.read' } as Permission,
              { name: 'sales.tickets.update' } as Permission,
            ],
          },
        } as UserRole,
        {
          role: {
            permissions: [{ name: 'inventory.items.read' } as Permission],
          },
        } as UserRole,
      ]);

      const result = await service.effectivePermissions('u1');
      expect(result.sort()).toEqual([
        'inventory.items.read',
        'sales.tickets.read',
        'sales.tickets.update',
      ]);
    });
  });

  describe('isSuperAdmin', () => {
    it('true when any role is superadmin', async () => {
      userRolesRepo.find.mockResolvedValue([
        { role: { isSuperAdmin: true } } as UserRole,
      ]);
      expect(await service.isSuperAdmin('u1')).toBe(true);
    });

    it('false when no role is superadmin', async () => {
      userRolesRepo.find.mockResolvedValue([
        { role: { isSuperAdmin: false } } as UserRole,
      ]);
      expect(await service.isSuperAdmin('u1')).toBe(false);
    });
  });

  describe('assertCanGrantPermissions', () => {
    it('rejects when granting permissions not in actor pool', async () => {
      userRolesRepo.find.mockResolvedValue([] as UserRole[]); // superadmin false
      permissionsRepo.find.mockResolvedValue([
        { id: 'p1', name: 'sales.tickets.cancel' } as Permission,
      ]);
      const bad = await service
        .assertCanGrantPermissions('u1', ['p1'])
        .catch((e: unknown) => e);
      expect(bad).toBeInstanceOf(ForbiddenException);
    });

    it('passes when granting permissions in actor pool', async () => {
      userRolesRepo.find.mockResolvedValue([
        {
          role: {
            permissions: [{ name: 'sales.tickets.cancel' } as Permission],
          },
        } as UserRole,
      ]);
      permissionsRepo.find.mockResolvedValue([
        { id: 'p1', name: 'sales.tickets.cancel' } as Permission,
      ]);
      await expect(
        service.assertCanGrantPermissions('u1', ['p1']),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertCanDelegate', () => {
    it('rejects delegating a capability the actor does not have', async () => {
      userRolesRepo.find.mockResolvedValue([
        {
          canCreateSubRoles: false,
          canCreateSubUsers: false,
        } as UserRole,
      ]);
      const bad = await service
        .assertCanDelegate('u1', {
          canCreateSubRoles: true,
          canCreateSubUsers: false,
        })
        .catch((e: unknown) => e);
      expect(bad).toBeInstanceOf(ForbiddenException);
    });

    it('passes delegating a capability the actor has', async () => {
      userRolesRepo.find.mockResolvedValue([
        {
          canCreateSubRoles: true,
          canCreateSubUsers: false,
        } as UserRole,
      ]);
      await expect(
        service.assertCanDelegate('u1', {
          canCreateSubRoles: true,
          canCreateSubUsers: false,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getDescendantUserIds', () => {
    it('walks the createdBy chain recursively', async () => {
      usersRepo.find.mockResolvedValue([
        { id: 'u2', createdById: 'u1' },
        { id: 'u3', createdById: 'u2' },
        { id: 'u4', createdById: 'u1' },
        { id: 'u5', createdById: 'u9' },
      ] as User[]);
      const result = await service.getDescendantUserIds('u1');
      expect(result.sort()).toEqual(['u2', 'u3', 'u4']);
    });
  });

  describe('assignDefaultAdminIfFirstUser', () => {
    beforeEach(() => {
      rolesRepo.findOne.mockResolvedValue({
        id: 'r1',
        name: 'admin',
        isSuperAdmin: true,
      });
      userRolesRepo.findOne.mockResolvedValue(null);
      userRolesRepo.create.mockImplementation((arg: object) => ({ ...arg }));
      userRolesRepo.save.mockResolvedValue({});
    });

    it('assigns superadmin to the matching RBAC_DEFAULT_ADMIN_EMAIL', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'RBAC_DEFAULT_ADMIN_EMAIL' ? 'boss@x.io' : 'true',
      );
      usersRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'boss@x.io',
      });

      await service.assignDefaultAdminIfFirstUser('u1');

      expect(userRolesRepo.save).toHaveBeenCalledTimes(1);
      expect(userRolesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', roleId: 'r1' }),
      );
    });

    it('skips when the email does not match', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'RBAC_DEFAULT_ADMIN_EMAIL' ? 'boss@x.io' : 'true',
      );
      usersRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'other@x.io',
      });

      await service.assignDefaultAdminIfFirstUser('u1');

      expect(userRolesRepo.save).not.toHaveBeenCalled();
    });

    it('assigns to the first user when no email is configured', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'RBAC_DEFAULT_ADMIN_EMAIL' ? '' : 'true',
      );
      usersRepo.count.mockResolvedValue(1);

      await service.assignDefaultAdminIfFirstUser('u1');

      expect(userRolesRepo.save).toHaveBeenCalledTimes(1);
    });

    it('skips when count is not 1 and no email is configured', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'RBAC_DEFAULT_ADMIN_EMAIL' ? '' : 'true',
      );
      usersRepo.count.mockResolvedValue(2);

      await service.assignDefaultAdminIfFirstUser('u1');

      expect(userRolesRepo.save).not.toHaveBeenCalled();
    });

    it('no-op when RBAC_DEFAULT_ADMIN_ROLE is false', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'RBAC_DEFAULT_ADMIN_ROLE' ? 'false' : 'true',
      );

      await service.assignDefaultAdminIfFirstUser('u1');

      expect(rolesRepo.findOne).not.toHaveBeenCalled();
      expect(userRolesRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('seedIfNeeded', () => {
    it('creates the admin role when RBAC_DEFAULT_ADMIN_ROLE is true', async () => {
      config.get.mockReturnValue('true');
      rolesRepo.findOne.mockResolvedValue(null);
      rolesRepo.create.mockImplementation((arg: object) => ({ ...arg }));
      rolesRepo.save.mockResolvedValue({ id: 'r1' });
      permissionsRepo.findOne.mockResolvedValue({ id: 'p1' });

      await service.seedIfNeeded();

      expect(rolesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isSuperAdmin: true }),
      );
    });

    it('skips the admin role when the flag is false', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'RBAC_DEFAULT_ADMIN_ROLE' ? 'false' : 'true',
      );

      await service.seedIfNeeded();

      expect(rolesRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('audit integration (no-op without AUDIT_SERVICE)', () => {
    it('does not throw when audit is not injected', async () => {
      permissionsRepo.findOne.mockResolvedValue(null);
      permissionsRepo.create.mockReturnValue({ name: 'x', description: null });
      permissionsRepo.save.mockResolvedValue({ id: 'p1', name: 'x' });

      await expect(
        service.createPermission('u1', { name: 'x' }),
      ).resolves.toBeDefined();
    });
  });

  describe('isFlatActor', () => {
    it('true for a top-level self-registered user', async () => {
      userRolesRepo.find.mockResolvedValue([] as UserRole[]);
      usersRepo.findOne.mockResolvedValue({
        id: 'u1',
        parentId: null,
        createdById: null,
      });
      expect(await service.isFlatActor('u1')).toBe(true);
    });

    it('false for a user created inside the account tree', async () => {
      userRolesRepo.find.mockResolvedValue([] as UserRole[]);
      usersRepo.findOne.mockResolvedValue({
        id: 'u2',
        parentId: 'u1',
        createdById: 'u1',
      });
      expect(await service.isFlatActor('u2')).toBe(false);
    });

    it('false for a superadmin', async () => {
      userRolesRepo.find.mockResolvedValue([
        { role: { isSuperAdmin: true } } as UserRole,
      ]);
      expect(await service.isFlatActor('u1')).toBe(false);
    });
  });

  describe('listVisibleUsers', () => {
    it('superadmin sees every user', async () => {
      userRolesRepo.find.mockResolvedValue([
        { role: { isSuperAdmin: true } } as UserRole,
      ]);
      const all = [{ id: 'u1' }, { id: 'u2' }] as User[];
      usersRepo.find.mockResolvedValue(all);
      const result = await service.listVisibleUsers('u1');
      expect(result).toEqual(all);
    });

    it('no organizations created → every user visible (flat behaviour)', async () => {
      userRolesRepo.find.mockResolvedValue([] as UserRole[]);
      tenant.myOrg.mockResolvedValue(null);
      usersRepo.find.mockResolvedValueOnce([] as User[]); // descendant map
      usersRepo.find.mockResolvedValue([
        { id: 'a', organizationId: null },
        { id: 'b', organizationId: null },
      ] as User[]);
      const result = await service.listVisibleUsers('u1');
      expect(result.map((u) => u.id).sort()).toEqual(['a', 'b']);
    });

    it('orgs in use → scoped to own organization + descendants', async () => {
      userRolesRepo.find.mockResolvedValue([] as UserRole[]);
      tenant.myOrg.mockResolvedValue('org-a');
      usersRepo.find.mockResolvedValueOnce([
        { id: 'child', createdById: 'u1' },
      ] as User[]); // descendant map
      usersRepo.find.mockResolvedValue([
        { id: 'self', organizationId: 'org-a' },
        { id: 'child', organizationId: 'org-a' },
        { id: 'other', organizationId: 'org-b' },
        { id: 'global', organizationId: null },
      ] as User[]);
      const result = await service.listVisibleUsers('u1');
      expect(result.map((u) => u.id).sort()).toEqual(['child', 'self']);
    });
  });

  describe('assertCanAssignRole (adaptive)', () => {
    beforeEach(() => {
      rolesRepo.findOne.mockResolvedValue({
        id: 'r1',
        name: 'worker',
        isSuperAdmin: false,
      });
    });

    it('flat actor can assign any visible role to any visible user', async () => {
      userRolesRepo.find.mockResolvedValue([] as UserRole[]);
      usersRepo.findOne.mockResolvedValue({
        id: 'u1',
        parentId: null,
        createdById: null,
      });
      await expect(
        service.assertCanAssignRole('u1', 'target', 'r1'),
      ).resolves.toBeUndefined();
      expect(tenant.assertUserAssignable).toHaveBeenCalledWith('u1', 'target');
      expect(tenant.assertRoleVisible).toHaveBeenCalledWith('u1', {
        id: 'r1',
        name: 'worker',
        isSuperAdmin: false,
      });
    });

    it('hierarchy actor still requires target in subtree', async () => {
      userRolesRepo.find.mockResolvedValue([] as UserRole[]);
      usersRepo.findOne.mockResolvedValue({
        id: 'u2',
        parentId: 'u1',
        createdById: 'u1',
      });
      usersRepo.find.mockResolvedValue([
        { id: 'leaf', createdById: 'u2' },
      ] as User[]);
      const bad = await service
        .assertCanAssignRole('u2', 'stranger', 'r1')
        .catch((e: unknown) => e);
      expect(bad).toBeInstanceOf(ForbiddenException);
    });

    it('superadmin bypasses all checks', async () => {
      userRolesRepo.find.mockResolvedValue([
        { role: { isSuperAdmin: true } } as UserRole,
      ]);
      await expect(
        service.assertCanAssignRole('boss', 'anyone', 'r1'),
      ).resolves.toBeUndefined();
    });
  });
});
