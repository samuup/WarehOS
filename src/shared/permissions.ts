export type Role = 'admin' | 'operator' | 'viewer';

export type Capability =
  | 'products.manage'
  | 'categories.manage'
  | 'inventory.manage'
  | 'users.manage'
  | 'users.create'
  | 'settings.manage'
  | 'audit.view'
  | 'reports.view'
  | 'auth.self';

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  admin: [
    'products.manage',
    'categories.manage',
    'inventory.manage',
    'users.manage',
    'users.create',
    'settings.manage',
    'audit.view',
    'reports.view',
    'auth.self',
  ],
  operator: [
    'products.manage',
    'categories.manage',
    'inventory.manage',
    'reports.view',
    'auth.self',
  ],
  viewer: ['reports.view', 'auth.self'],
};

const ROLE_RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

export function can(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function roleAtLeast(role: Role | undefined | null, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
