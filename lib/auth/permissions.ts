// Role-based access control. Pure module: safe to import from anywhere,
// including tests and client components (it contains no secrets).
// The server is the only place where these checks are enforced.

export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'EDITOR'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  OPERATOR: 'Оператор',
  EDITOR: 'Монтажёр',
};

export const PERMISSIONS = [
  'dashboard:view',
  'leads:view',
  'leads:manage',
  'clients:view',
  'clients:manage',
  'clients:merge',
  'bookings:view',
  'bookings:manage',
  'calendar:view',
  'payments:view',
  'payments:manage',
  'refunds:manage',
  'production:view',
  'production:manage',
  'production:work',
  'tours:view',
  'tours:manage',
  'activity:view',
  'integrations:view',
  'settings:view',
  'settings:manage',
  'integrations:manage',
  'users:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const OWNER_ONLY: readonly Permission[] = ['users:manage', 'integrations:manage'];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  ADMIN: new Set(PERMISSIONS.filter((p) => !OWNER_ONLY.includes(p))),
  MANAGER: new Set<Permission>([
    'dashboard:view',
    'leads:view',
    'leads:manage',
    'clients:view',
    'clients:manage',
    'bookings:view',
    'bookings:manage',
    'calendar:view',
    'payments:view',
    'payments:manage',
    'production:view',
    'production:manage',
    'tours:view',
    'tours:manage',
  ]),
  OPERATOR: new Set<Permission>([
    'dashboard:view',
    'bookings:view',
    'calendar:view',
    'payments:view',
    'production:view',
    'production:work',
    'tours:view',
    'tours:manage',
  ]),
  EDITOR: new Set<Permission>(['dashboard:view', 'payments:view', 'production:view', 'production:work']),
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return PERMISSIONS.filter((p) => hasPermission(role, p));
}

// ─── Production tasks ─────────────────────────────────────────────────────────

/** Task types each hands-on role may work on (only when the task is assigned to them). */
export const TASK_TYPES_BY_ROLE: Partial<Record<Role, readonly string[]>> = {
  OPERATOR: ['PREPARATION', 'RECORDING'],
  EDITOR: ['EDITING', 'SHORTS', 'THUMBNAIL', 'REVIEW', 'DELIVERY'],
};

/**
 * Whether a user may update a task's progress (status, checklist, comments, materials).
 * Managers (production:manage) may update any task; OPERATOR/EDITOR only their own
 * tasks of their types. Assignment, due date and priority always need production:manage.
 */
export function canWorkOnTask(user: { id: string; role: Role }, task: { type: string; assignedToId: string | null }): boolean {
  if (hasPermission(user.role, 'production:manage')) return true;
  if (!hasPermission(user.role, 'production:work')) return false;
  return task.assignedToId === user.id && (TASK_TYPES_BY_ROLE[user.role]?.includes(task.type) ?? false);
}
