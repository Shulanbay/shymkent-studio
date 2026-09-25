import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import { consumeRateLimit, resetRateLimit } from '@/lib/rate-limit';
import {
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from './constants';
import { verifyPassword } from './password';
import type { Role } from './permissions';
import { generateSessionToken, hashSessionToken, keyedHash } from './tokens';

// Database-level auth logic. Takes its dependencies as arguments so it can be
// exercised by integration tests without Next.js request context.

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const LOGIN_LIMITS = {
  perIp: { limit: 20, windowSeconds: 15 * 60 },
  perAccount: { limit: 5, windowSeconds: 15 * 60 },
} as const;

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254)),
  password: z.string().min(1).max(256),
});

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; user: SessionUser }
  | { ok: false; error: 'INVALID_INPUT' | 'INVALID_CREDENTIALS' | 'RATE_LIMITED'; retryAfterSeconds?: number };

export async function authenticate(
  db: PrismaClient,
  params: { secret: string; email: unknown; password: unknown; clientIp: string; userAgent?: string | null },
): Promise<LoginResult> {
  const parsed = loginInputSchema.safeParse({ email: params.email, password: params.password });
  if (!parsed.success) return { ok: false, error: 'INVALID_INPUT' };
  const { email, password } = parsed.data;

  const ipKey = `login:ip:${keyedHash(params.secret, params.clientIp)}`;
  const accountKey = `login:acct:${keyedHash(params.secret, email)}`;
  const [ipLimit, accountLimit] = await Promise.all([
    // Unknown IP (no proxy) = one bucket shared by every visitor: keep it from locking everyone out;
    // the per-account limit still stops password guessing.
    consumeRateLimit(db, ipKey, LOGIN_LIMITS.perIp.limit * (params.clientIp === 'unknown' ? 20 : 1), LOGIN_LIMITS.perIp.windowSeconds),
    consumeRateLimit(db, accountKey, LOGIN_LIMITS.perAccount.limit, LOGIN_LIMITS.perAccount.windowSeconds),
  ]);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    // Log only the first blocked attempt of a window, so an attack cannot flood the log.
    const firstBlocked = (!ipLimit.allowed && !ipLimit.previouslyBlocked) || accountLimit.count === LOGIN_LIMITS.perAccount.limit + 1;
    if (firstBlocked) {
      await logActivity(db, {
        entityType: 'Auth',
        action: 'auth.login.rate_limited',
        metadata: { scope: accountLimit.allowed ? 'ip' : 'account' },
      });
    }
    return {
      ok: false,
      error: 'RATE_LIMITED',
      retryAfterSeconds: Math.max(ipLimit.allowed ? 0 : ipLimit.retryAfterSeconds, accountLimit.allowed ? 0 : accountLimit.retryAfterSeconds),
    };
  }

  const user = await db.user.findUnique({ where: { email } });
  // verifyPassword spends the same time when the user does not exist.
  const passwordOk = await verifyPassword(user?.passwordHash, password);

  if (!user || !passwordOk || !user.active) {
    await logActivity(db, {
      userId: user?.id ?? null,
      entityType: 'Auth',
      entityId: user?.id ?? null,
      action: 'auth.login.failed',
      metadata: user ? { reason: passwordOk ? 'inactive' : 'bad_password' } : { reason: 'unknown_account' },
    });
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_IDLE_TIMEOUT_MS);
  await db.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: user.id,
        expiresAt,
        userAgent: params.userAgent?.slice(0, 200) ?? null,
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    await logActivity(tx, { userId: user.id, entityType: 'Auth', entityId: user.id, action: 'auth.login' });
  });
  await resetRateLimit(db, accountKey);

  return {
    ok: true,
    token,
    expiresAt,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export async function validateSessionToken(db: PrismaClient, token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 128) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });
  if (!session) return null;

  const now = Date.now();
  const absoluteDeadline = session.createdAt.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS;
  if (session.expiresAt.getTime() <= now || absoluteDeadline <= now || !session.user.active) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (now - session.lastUsedAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await db.session
      .update({
        where: { id: session.id },
        data: {
          lastUsedAt: new Date(now),
          expiresAt: new Date(Math.min(now + SESSION_IDLE_TIMEOUT_MS, absoluteDeadline)),
        },
      })
      .catch(() => undefined);
  }

  const { id, name, email, role } = session.user;
  return { id, name, email, role };
}

export async function revokeSessionToken(db: PrismaClient, token: string): Promise<string | null> {
  const session = await db.session.findUnique({ where: { tokenHash: hashSessionToken(token) } });
  if (!session) return null;
  await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
  return session.userId;
}

export async function revokeAllSessions(db: PrismaClient, userId: string): Promise<number> {
  const { count } = await db.session.deleteMany({ where: { userId } });
  return count;
}
