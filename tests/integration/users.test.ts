import { beforeEach, describe, expect, it } from 'vitest';
import { UserRuleError, createStaffUser, resetStaffPassword, updateStaffUser } from '@/lib/admin/users';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import type { SessionUser } from '@/lib/auth/service';
import { db, truncateAll } from '../support/db';

let owner: SessionUser;

beforeEach(async () => {
  await truncateAll();
  const u = await db.user.create({
    data: { email: 'owner@example.test', name: 'Owner', role: 'OWNER', passwordHash: await hashPassword('Owner-Password-2026') },
  });
  owner = { id: u.id, name: u.name, email: u.email, role: 'OWNER' };
});

describe('staff management rules', () => {
  it('creates a user with a hashed password and logs it', async () => {
    const user = await createStaffUser(db, owner, {
      name: 'Aigerim',
      email: 'AIGERIM@example.test',
      role: 'MANAGER',
      password: 'Manager-Password-2026',
    });
    expect(user.email).toBe('aigerim@example.test');
    expect(await verifyPassword(user.passwordHash, 'Manager-Password-2026')).toBe(true);
    const log = await db.activityLog.findFirst({ where: { action: 'user.create' } });
    expect(log).toMatchObject({ userId: owner.id, entityId: user.id, metadata: { role: 'MANAGER' } });
    expect(JSON.stringify(log?.metadata)).not.toContain('Password');
  });

  it('rejects duplicate emails and weak passwords', async () => {
    const input = { name: 'A', email: 'a@example.test', role: 'EDITOR', password: 'Editor-Password-2026' };
    await createStaffUser(db, owner, input);
    await expect(createStaffUser(db, owner, input)).rejects.toThrow(UserRuleError);
    await expect(createStaffUser(db, owner, { ...input, email: 'b@example.test', password: 'short' })).rejects.toThrow();
  });

  it('does not let the owner demote or deactivate themselves', async () => {
    await expect(updateStaffUser(db, owner, { userId: owner.id, role: 'ADMIN', active: true })).rejects.toThrow(UserRuleError);
    await expect(updateStaffUser(db, owner, { userId: owner.id, role: 'OWNER', active: false })).rejects.toThrow(UserRuleError);
  });

  it('keeps at least one active owner', async () => {
    const second = await createStaffUser(db, owner, { name: 'Co', email: 'co@example.test', role: 'OWNER', password: 'Co-Owner-Password-2026' });
    const coOwner: SessionUser = { id: second.id, name: 'Co', email: second.email, role: 'OWNER' };
    // Co-owner demotes the first owner — allowed, one active owner remains.
    await updateStaffUser(db, coOwner, { userId: owner.id, role: 'ADMIN', active: true });
    // Nobody can now remove the last active owner.
    await expect(updateStaffUser(db, owner, { userId: second.id, role: 'ADMIN', active: true })).rejects.toThrow(
      'хотя бы один активный владелец',
    );
  });

  it('deactivation signs the user out everywhere and is logged with the change', async () => {
    const staff = await createStaffUser(db, owner, { name: 'Op', email: 'op@example.test', role: 'OPERATOR', password: 'Operator-Password-2026' });
    await db.session.create({ data: { tokenHash: 'h1', userId: staff.id, expiresAt: new Date(Date.now() + 3600_000) } });
    await updateStaffUser(db, owner, { userId: staff.id, role: 'OPERATOR', active: false });
    expect(await db.session.count({ where: { userId: staff.id } })).toBe(0);
    const log = await db.activityLog.findFirst({ where: { action: 'user.update' } });
    expect(log?.metadata).toEqual({ active: { from: true, to: false } });
  });

  it('password reset replaces the hash and revokes sessions', async () => {
    const staff = await createStaffUser(db, owner, { name: 'Ed', email: 'ed@example.test', role: 'EDITOR', password: 'Editor-Password-2026' });
    await db.session.create({ data: { tokenHash: 'h2', userId: staff.id, expiresAt: new Date(Date.now() + 3600_000) } });
    await resetStaffPassword(db, owner, { userId: staff.id, password: 'Brand-New-Password-1' });
    const updated = await db.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(await verifyPassword(updated.passwordHash, 'Brand-New-Password-1')).toBe(true);
    expect(await db.session.count({ where: { userId: staff.id } })).toBe(0);
  });
});
