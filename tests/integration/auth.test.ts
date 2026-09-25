import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@/lib/auth/password';
import { LOGIN_LIMITS, authenticate, revokeSessionToken, validateSessionToken } from '@/lib/auth/service';
import { hashSessionToken } from '@/lib/auth/tokens';
import { db, truncateAll } from '../support/db';

const secret = 'integration-test-secret-integration-test-secret';
const PASSWORD = 'Owner-Password-2026';

async function createUser(overrides: Partial<{ email: string; role: 'OWNER' | 'MANAGER'; active: boolean }> = {}) {
  return db.user.create({
    data: {
      email: overrides.email ?? 'owner@example.test',
      name: 'Owner',
      role: overrides.role ?? 'OWNER',
      active: overrides.active ?? true,
      passwordHash: await hashPassword(PASSWORD),
    },
  });
}

const login = (email: string, password: string, clientIp = '10.0.0.1') =>
  authenticate(db, { secret, email, password, clientIp, userAgent: 'vitest' });

beforeEach(truncateAll);

describe('authenticate', () => {
  it('creates a session, stores only the token hash and logs the login', async () => {
    const user = await createUser();
    const result = await login('Owner@Example.test ', PASSWORD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user).toMatchObject({ id: user.id, role: 'OWNER' });

    const sessions = await db.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(hashSessionToken(result.token));
    expect(sessions[0].tokenHash).not.toBe(result.token);

    const log = await db.activityLog.findFirst({ where: { action: 'auth.login' } });
    expect(log?.userId).toBe(user.id);
    expect((await db.user.findUnique({ where: { id: user.id } }))?.lastLoginAt).not.toBeNull();
  });

  it('rejects a wrong password without creating a session', async () => {
    await createUser();
    expect(await login('owner@example.test', 'wrong-password')).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });
    expect(await db.session.count()).toBe(0);
    const log = await db.activityLog.findFirst({ where: { action: 'auth.login.failed' } });
    expect(log?.metadata).toEqual({ reason: 'bad_password' });
  });

  it('gives the same answer for unknown accounts (no enumeration)', async () => {
    expect(await login('nobody@example.test', PASSWORD)).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });
  });

  it('rejects deactivated users', async () => {
    await createUser({ active: false });
    expect(await login('owner@example.test', PASSWORD)).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });
  });

  it('rejects malformed input', async () => {
    expect(await login('not-an-email', PASSWORD)).toEqual({ ok: false, error: 'INVALID_INPUT' });
  });

  it('locks an account after 5 attempts even from different IPs', async () => {
    await createUser();
    for (let i = 0; i < LOGIN_LIMITS.perAccount.limit; i++) {
      await login('owner@example.test', 'wrong', `10.0.1.${i}`);
    }
    const blocked = await login('owner@example.test', PASSWORD, '10.0.2.1');
    expect(blocked).toMatchObject({ ok: false, error: 'RATE_LIMITED' });
    expect(await db.activityLog.count({ where: { action: 'auth.login.rate_limited' } })).toBe(1);
  });

  it('limits attempts per IP across accounts', async () => {
    for (let i = 0; i < LOGIN_LIMITS.perIp.limit; i++) {
      await login(`user${i}@example.test`, 'wrong', '10.9.9.9');
    }
    expect(await login('another@example.test', 'wrong', '10.9.9.9')).toMatchObject({ error: 'RATE_LIMITED' });
    // A different IP is not affected.
    expect(await login('another@example.test', 'wrong', '10.9.9.10')).toMatchObject({ error: 'INVALID_CREDENTIALS' });
  });

  it('stores rate-limit keys without raw IPs or emails', async () => {
    await login('owner@example.test', 'wrong', '203.0.113.7');
    const keys = (await db.rateLimit.findMany()).map((r) => r.key).join(' ');
    expect(keys).not.toContain('203.0.113.7');
    expect(keys).not.toContain('owner@example.test');
  });
});

describe('sessions', () => {
  it('validates, then rejects after revocation', async () => {
    await createUser();
    const result = await login('owner@example.test', PASSWORD);
    if (!result.ok) throw new Error('login failed');
    expect(await validateSessionToken(db, result.token)).toMatchObject({ email: 'owner@example.test', role: 'OWNER' });
    await revokeSessionToken(db, result.token);
    expect(await validateSessionToken(db, result.token)).toBeNull();
  });

  it('rejects expired sessions and deletes them', async () => {
    await createUser();
    const result = await login('owner@example.test', PASSWORD);
    if (!result.ok) throw new Error('login failed');
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateSessionToken(db, result.token)).toBeNull();
    expect(await db.session.count()).toBe(0);
  });

  it('rejects sessions older than the absolute lifetime', async () => {
    await createUser();
    const result = await login('owner@example.test', PASSWORD);
    if (!result.ok) throw new Error('login failed');
    await db.session.updateMany({ data: { createdAt: new Date(Date.now() - 8 * 24 * 3600_000) } });
    expect(await validateSessionToken(db, result.token)).toBeNull();
  });

  it('reflects role changes immediately and rejects sessions of deactivated users', async () => {
    const user = await createUser();
    const result = await login('owner@example.test', PASSWORD);
    if (!result.ok) throw new Error('login failed');
    await db.user.update({ where: { id: user.id }, data: { role: 'MANAGER' } });
    expect((await validateSessionToken(db, result.token))?.role).toBe('MANAGER');
    await db.user.update({ where: { id: user.id }, data: { active: false } });
    expect(await validateSessionToken(db, result.token)).toBeNull();
  });

  it('ignores unknown or oversized tokens', async () => {
    expect(await validateSessionToken(db, 'forged')).toBeNull();
    expect(await validateSessionToken(db, 'x'.repeat(500))).toBeNull();
    expect(await validateSessionToken(db, undefined)).toBeNull();
  });
});
