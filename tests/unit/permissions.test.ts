import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES, hasPermission, isRole, permissionsFor } from '@/lib/auth/permissions';

describe('role-based permissions', () => {
  it('OWNER has every permission', () => {
    for (const permission of PERMISSIONS) expect(hasPermission('OWNER', permission)).toBe(true);
  });

  it('only OWNER can manage users and integrations', () => {
    for (const role of ROLES.filter((r) => r !== 'OWNER')) {
      expect(hasPermission(role, 'users:manage')).toBe(false);
      expect(hasPermission(role, 'integrations:manage')).toBe(false);
    }
  });

  it('ADMIN has everything except owner-only permissions', () => {
    expect(permissionsFor('ADMIN')).toEqual(PERMISSIONS.filter((p) => p !== 'users:manage' && p !== 'integrations:manage'));
  });

  it('only OWNER and ADMIN can change settings, refunds, merge clients and see integration errors', () => {
    for (const role of ['MANAGER', 'OPERATOR', 'EDITOR'] as const) {
      expect(hasPermission(role, 'settings:manage')).toBe(false);
      expect(hasPermission(role, 'refunds:manage')).toBe(false);
      expect(hasPermission(role, 'clients:merge')).toBe(false);
      expect(hasPermission(role, 'integrations:view')).toBe(false);
    }
    for (const role of ['OWNER', 'ADMIN'] as const) {
      expect(hasPermission(role, 'clients:merge')).toBe(true);
      expect(hasPermission(role, 'integrations:view')).toBe(true);
    }
  });

  it('OPERATOR sees the calendar and tours but cannot manage bookings or clients', () => {
    expect(hasPermission('OPERATOR', 'calendar:view')).toBe(true);
    expect(hasPermission('OPERATOR', 'tours:manage')).toBe(true);
    expect(hasPermission('OPERATOR', 'bookings:manage')).toBe(false);
    expect(hasPermission('OPERATOR', 'clients:view')).toBe(false);
  });

  it('EDITOR works on production only; finance is read-only; no bookings or clients', () => {
    expect(permissionsFor('EDITOR')).toEqual(['dashboard:view', 'payments:view', 'production:view', 'production:work']);
    expect(hasPermission('EDITOR', 'bookings:view')).toBe(false);
    expect(hasPermission('EDITOR', 'payments:manage')).toBe(false);
  });

  it('MANAGER handles sales, records payments and assigns production, but cannot refund or reverse', () => {
    expect(hasPermission('MANAGER', 'bookings:manage')).toBe(true);
    expect(hasPermission('MANAGER', 'payments:manage')).toBe(true);
    expect(hasPermission('MANAGER', 'production:manage')).toBe(true);
    expect(hasPermission('MANAGER', 'refunds:manage')).toBe(false);
    expect(hasPermission('MANAGER', 'users:manage')).toBe(false);
  });

  it('isRole validates role strings', () => {
    expect(isRole('OWNER')).toBe(true);
    expect(isRole('owner')).toBe(false);
    expect(isRole('ROOT')).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
