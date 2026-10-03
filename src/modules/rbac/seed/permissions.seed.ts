export interface PermissionSeed {
  name: string;
  description: string;
}

export const DEFAULT_PERMISSIONS: PermissionSeed[] = [
  {
    name: 'rbac.permissions.create',
    description: 'Create permissions',
  },
  {
    name: 'rbac.permissions.read',
    description: 'List/read permissions',
  },
  {
    name: 'rbac.permissions.update',
    description: 'Update permissions',
  },
  {
    name: 'rbac.permissions.delete',
    description: 'Delete permissions',
  },
  {
    name: 'rbac.roles.create',
    description: 'Create roles',
  },
  {
    name: 'rbac.roles.read',
    description: 'List/read roles',
  },
  {
    name: 'rbac.roles.update',
    description: 'Update roles',
  },
  {
    name: 'rbac.roles.delete',
    description: 'Delete roles',
  },
  {
    name: 'rbac.users.create',
    description: 'Create child users',
  },
  {
    name: 'rbac.users.read',
    description: 'List child users',
  },
  {
    name: 'rbac.users.assign',
    description: 'Assign roles to users',
  },
  {
    name: 'rbac.audit.read',
    description: 'Read audit logs',
  },
  {
    name: 'rbac.organizations.read',
    description: 'List/read organizations',
  },
  {
    name: 'rbac.organizations.create',
    description: 'Create organizations',
  },
  {
    name: 'rbac.organizations.update',
    description: 'Update organizations',
  },
  {
    name: 'rbac.organizations.delete',
    description: 'Delete organizations',
  },
  {
    name: 'rbac.organizations.assign',
    description: 'Assign users to organizations',
  },
];
