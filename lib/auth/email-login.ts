import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import { consumeRateLimit } from '@/lib/rate-limit';
import { startSession, type SessionUser } from './service';
import { generateSessionToken, hashSessionToken, keyedHash } from './tokens';

// Sign-in by a one-time link sent to the staff member's email ("magic link").
// - The link carries a 256-bit random token; only its SHA-256 is stored.
// - It expires after EMAIL_LINK_TTL_MINUTES and works once (atomic consume).
// - Requesting a new link invalidates older unused links of that account.
// - The answer never reveals whether an email belongs to a staff account.

export const EMAIL_LINK_TTL_MINUTES = 15;
export const EMAIL_LINK_LIMITS = {
  perAccount: { limit: 3, windowSeconds: 15 * 60 },
  perIp: { limit: 10, windowSeconds: 15 * 60 },
} as const;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254));

export type EmailLinkRequest =
  | { status: 'sent'; token: string; user: Pick<SessionUser, 'id' | 'name' | 'email'> }
  /** Unknown or inactive account: nothing is sent, but the caller shows the same message. */
  | { status: 'no_account' }
  | { status: 'invalid_email' }
  | { status: 'rate_limited'; retryAfterSeconds: number };

export async function requestEmailLogin(
  db: PrismaClient,
  params: { secret: string; email: unknown; clientIp: string; now?: Date },
): Promise<EmailLinkRequest> {
  const parsed = emailSchema.safeParse(params.email);
  if (!parsed.success) return { status: 'invalid_email' };
  const email = parsed.data;
  const now = params.now ?? new Date();

  const unknownIp = params.clientIp === 'unknown';
  const [ipLimit, accountLimit] = await Promise.all([
    consumeRateLimit(
      db,
      `emaillink:ip:${keyedHash(params.secret, params.clientIp)}`,
      EMAIL_LINK_LIMITS.perIp.limit * (unknownIp ? 20 : 1),
      EMAIL_LINK_LIMITS.perIp.windowSeconds,
    ),
    consumeRateLimit(db, `emaillink:acct:${keyedHash(params.secret, email)}`, EMAIL_LINK_LIMITS.perAccount.limit, EMAIL_LINK_LIMITS.perAccount.windowSeconds),
  ]);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    return {
      status: 'rate_limited',
      retryAfterSeconds: Math.max(ipLimit.allowed ? 0 : ipLimit.retryAfterSeconds, accountLimit.allowed ? 0 : accountLimit.retryAfterSeconds),
    };
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, active: true } });
  if (!user || !user.active) {
    await logActivity(db, { entityType: 'Auth', action: 'auth.email_link.unknown', metadata: { reason: user ? 'inactive' : 'unknown_account' } });
    return { status: 'no_account' };
  }

  const token = generateSessionToken();
  await db.$transaction(async (tx) => {
    // Only the newest link is valid.
    await tx.loginToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    await tx.loginToken.create({
      data: { tokenHash: hashSessionToken(token), userId: user.id, expiresAt: new Date(now.getTime() + EMAIL_LINK_TTL_MINUTES * 60_000) },
    });
    await logActivity(tx, { userId: user.id, entityType: 'Auth', entityId: user.id, action: 'auth.email_link.requested' });
  });
  // Housekeeping: drop links that expired more than a day ago.
  await db.loginToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86_400_000) } } }).catch(() => undefined);
  return { status: 'sent', token, user: { id: user.id, name: user.name, email: user.email } };
}

export type EmailLinkResult = { ok: true; token: string; expiresAt: Date } | { ok: false; error: 'INVALID_OR_EXPIRED' };

/** Exchanges a link token for a session. The token is consumed atomically, so it cannot be used twice. */
export async function consumeEmailLogin(
  db: PrismaClient,
  params: { token: unknown; userAgent?: string | null; now?: Date },
): Promise<EmailLinkResult> {
  if (typeof params.token !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(params.token)) return { ok: false, error: 'INVALID_OR_EXPIRED' };
  const now = params.now ?? new Date();
  const tokenHash = hashSessionToken(params.token);
  return db.$transaction(async (tx) => {
    const claimed = await tx.loginToken.updateMany({ where: { tokenHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claimed.count !== 1) return { ok: false as const, error: 'INVALID_OR_EXPIRED' as const };
    const link = await tx.loginToken.findUniqueOrThrow({ where: { tokenHash }, include: { user: { select: { id: true, active: true } } } });
    if (!link.user.active) return { ok: false as const, error: 'INVALID_OR_EXPIRED' as const };
    const session = await startSession(tx, link.user.id, params.userAgent, 'email_link');
    return { ok: true as const, ...session };
  });
}
