import { execSync } from 'node:child_process';
import { beforeEach, describe, expect, it } from 'vitest';
import { OwnerResetError, resetOwnerPassword } from '@/lib/admin/owner-reset';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { authenticate, validateSessionToken } from '@/lib/auth/service';
import { db, truncateAll } from '../support/db';

const secret = 'integration-test-secret-integration-test-secret';
const EMAIL = 'owner@example.test';
const NEW_PASSWORD = 'Fresh-Studio-Pass-2026!';

beforeEach(async () => {
  await truncateAll();
  await db.user.create({ data: { email: EMAIL, name: 'Owner', role: 'OWNER', passwordHash: await hashPassword('Old-Owner-Password-2026') } });
  await db.user.create({ data: { email: 'manager@example.test', name: 'M', role: 'MANAGER', passwordHash: await hashPassword('Manager-Password-2026') } });
});

describe('owner password reset', () => {
  it('1. resets the password, stores only a hash and logs the fact without the password', async () => {
    await resetOwnerPassword(db, { email: EMAIL, password: NEW_PASSWORD, confirmation: EMAIL, authSecret: secret });
    const owner = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(await verifyPassword(owner.passwordHash, NEW_PASSWORD)).toBe(true);
    expect(owner.passwordHash).not.toContain(NEW_PASSWORD);
    const log = await db.activityLog.findFirstOrThrow({ where: { action: 'user.password_reset.cli' } });
    expect(log.entityId).toBe(owner.id);
    expect(JSON.stringify(log)).not.toContain(NEW_PASSWORD);
    expect((await authenticate(db, { secret, email: EMAIL, password: NEW_PASSWORD, clientIp: '10.1.1.1' })).ok).toBe(true);
  });

  it('2. revokes every active session of the owner', async () => {
    const login = await authenticate(db, { secret, email: EMAIL, password: 'Old-Owner-Password-2026', clientIp: '10.1.1.2' });
    if (!login.ok) throw new Error('login failed');
    expect(await validateSessionToken(db, login.token)).not.toBeNull();
    const result = await resetOwnerPassword(db, { email: EMAIL, password: NEW_PASSWORD, confirmation: EMAIL });
    expect(result.sessionsRevoked).toBe(1);
    expect(await validateSessionToken(db, login.token)).toBeNull();
  });

  it('lifts a login lockout for the account', async () => {
    for (let i = 0; i < 6; i++) await authenticate(db, { secret, email: EMAIL, password: 'wrong', clientIp: `10.2.0.${i}` });
    await resetOwnerPassword(db, { email: EMAIL, password: NEW_PASSWORD, confirmation: EMAIL, authSecret: secret });
    expect((await authenticate(db, { secret, email: EMAIL, password: NEW_PASSWORD, clientIp: '10.2.1.1' })).ok).toBe(true);
  });

  it.each([
    ['weak password', { password: 'short' }],
    ['missing confirmation', { confirmation: '' }],
    ['wrong confirmation', { confirmation: 'other@example.test' }],
    ['non-owner account', { email: 'manager@example.test', confirmation: 'manager@example.test' }],
    ['unknown account', { email: 'nobody@example.test', confirmation: 'nobody@example.test' }],
    ['password containing the email name', { password: 'Owner-Is-Me-2026!!' }],
  ])('refuses: %s (and changes nothing)', async (_label, patch) => {
    const before = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    await expect(resetOwnerPassword(db, { email: EMAIL, password: NEW_PASSWORD, confirmation: EMAIL, ...patch })).rejects.toThrow(OwnerResetError);
    expect((await db.user.findUniqueOrThrow({ where: { email: EMAIL } })).passwordHash).toBe(before.passwordHash);
    expect(await db.activityLog.count({ where: { action: 'user.password_reset.cli' } })).toBe(0);
  });

  it('the CLI works non-interactively via environment variables and prints no password', () => {
    const output = execSync('npx tsx scripts/reset-owner-password.ts', {
      env: { ...process.env, ADMIN_RESET_EMAIL: EMAIL, ADMIN_RESET_PASSWORD: NEW_PASSWORD, ADMIN_RESET_CONFIRM: EMAIL },
      stdio: 'pipe',
    }).toString();
    expect(output).toContain('Password reset');
    expect(output).not.toContain(NEW_PASSWORD);
  });

  it('the CLI refuses without explicit confirmation', () => {
    expect(() =>
      execSync('npx tsx scripts/reset-owner-password.ts', {
        env: { ...process.env, ADMIN_RESET_EMAIL: EMAIL, ADMIN_RESET_PASSWORD: NEW_PASSWORD, ADMIN_RESET_CONFIRM: '' },
        stdio: 'pipe',
      }),
    ).toThrow();
  });
});
