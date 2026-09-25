import 'server-only';
import type { PrismaClient } from '@prisma/client';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
  /** true when this window was already over the limit before this request. */
  previouslyBlocked: boolean;
}

/**
 * Fixed-window counter stored in PostgreSQL, so limits hold across server
 * instances and restarts. The upsert is a single atomic statement.
 * `key` must not contain personal data in clear text — hash it first.
 */
export async function consumeRateLimit(
  db: PrismaClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `;
  const row = rows[0];
  const retryAfterSeconds = Math.max(0, Math.ceil((new Date(row.resetAt).getTime() - Date.now()) / 1000));

  // Opportunistic cleanup of expired windows.
  if (Math.random() < 0.02) {
    await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } }).catch(() => undefined);
  }

  return { allowed: row.count <= limit, count: row.count, retryAfterSeconds, previouslyBlocked: row.count > limit + 1 };
}

export async function resetRateLimit(db: PrismaClient, key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}
