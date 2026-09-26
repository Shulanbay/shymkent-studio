import { beforeEach, describe, expect, it } from 'vitest';
import { EMAIL_LINK_LIMITS, EMAIL_LINK_TTL_MINUTES, consumeEmailLogin, requestEmailLogin } from '@/lib/auth/email-login';
import { validateSessionToken } from '@/lib/auth/service';
import { hashSessionToken } from '@/lib/auth/tokens';
import { db, truncateAll } from '../support/db';

const secret = 'integration-test-secret-integration-test-secret';
let ipCounter = 0;
const request = (email: string, now?: Date) => requestEmailLogin(db, { secret, email, clientIp: `10.9.0.${++ipCounter % 250}`, now });

async function staff(email = 'owner@example.test', active = true) {
  return db.user.create({ data: { email, name: 'Владелец', role: 'OWNER', active, passwordHash: null } });
}

beforeEach(truncateAll);

describe('email sign-in link', () => {
  it('issues a one-time link for an active staff member and stores only its hash', async () => {
    const user = await staff();
    const r = await request(' Owner@Example.test ');
    expect(r.status).toBe('sent');
    if (r.status !== 'sent') return;
    expect(r.user.id).toBe(user.id);
    const rows = await db.loginToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashSessionToken(r.token));
    expect(rows[0].tokenHash).not.toContain(r.token);
    const ttl = rows[0].expiresAt.getTime() - rows[0].createdAt.getTime();
    expect(Math.round(ttl / 60_000)).toBe(EMAIL_LINK_TTL_MINUTES);
  });

  it('does not reveal or create anything for unknown or deactivated emails', async () => {
    await staff('former@example.test', false);
    expect((await request('nobody@example.test')).status).toBe('no_account');
    expect((await request('former@example.test')).status).toBe('no_account');
    expect((await request('not-an-email')).status).toBe('invalid_email');
    expect(await db.loginToken.count()).toBe(0);
  });

  it('signs in once; the same link cannot be used again', async () => {
    const user = await staff();
    const r = await request('owner@example.test');
    if (r.status !== 'sent') throw new Error('not sent');
    const first = await consumeEmailLogin(db, { token: r.token, userAgent: 'vitest' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(await validateSessionToken(db, first.token)).toMatchObject({ id: user.id, role: 'OWNER' });
    const log = await db.activityLog.findFirst({ where: { action: 'auth.login' } });
    expect(log?.metadata).toEqual({ method: 'email_link' });
    expect(await consumeEmailLogin(db, { token: r.token })).toEqual({ ok: false, error: 'INVALID_OR_EXPIRED' });
  });

  it('rejects expired, garbage and superseded links', async () => {
    await staff();
    const past = new Date(Date.now() - (EMAIL_LINK_TTL_MINUTES + 1) * 60_000);
    const expired = await request('owner@example.test', past);
    if (expired.status !== 'sent') throw new Error('not sent');
    expect((await consumeEmailLogin(db, { token: expired.token })).ok).toBe(false);

    const older = await request('owner@example.test');
    const newer = await request('owner@example.test');
    if (older.status !== 'sent' || newer.status !== 'sent') throw new Error('not sent');
    expect((await consumeEmailLogin(db, { token: older.token })).ok).toBe(false);
    expect((await consumeEmailLogin(db, { token: newer.token })).ok).toBe(true);

    expect((await consumeEmailLogin(db, { token: 'short' })).ok).toBe(false);
    expect((await consumeEmailLogin(db, { token: 'x'.repeat(43) })).ok).toBe(false);
    expect((await consumeEmailLogin(db, { token: 42 })).ok).toBe(false);
  });

  it('a link stops working when the account is deactivated', async () => {
    const user = await staff();
    const r = await request('owner@example.test');
    if (r.status !== 'sent') throw new Error('not sent');
    await db.user.update({ where: { id: user.id }, data: { active: false } });
    expect((await consumeEmailLogin(db, { token: r.token })).ok).toBe(false);
    expect(await db.session.count()).toBe(0);
  });

  it('limits link requests per account (unknown emails are limited the same way)', async () => {
    await staff();
    for (let i = 0; i < EMAIL_LINK_LIMITS.perAccount.limit; i++) expect((await request('owner@example.test')).status).toBe('sent');
    const blocked = await request('owner@example.test');
    expect(blocked.status).toBe('rate_limited');
    for (let i = 0; i < EMAIL_LINK_LIMITS.perAccount.limit; i++) await request('ghost@example.test');
    expect((await request('ghost@example.test')).status).toBe('rate_limited');
  });

  it('limits requests per IP address', async () => {
    await staff();
    const ip = '10.8.8.8';
    for (let i = 0; i < EMAIL_LINK_LIMITS.perIp.limit; i++) await requestEmailLogin(db, { secret, email: `u${i}@example.test`, clientIp: ip });
    expect((await requestEmailLogin(db, { secret, email: 'owner@example.test', clientIp: ip })).status).toBe('rate_limited');
  });
});
