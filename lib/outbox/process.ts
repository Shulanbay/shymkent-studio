import 'server-only';
import { Prisma, type IntegrationJob, type PrismaClient } from '@prisma/client';
import { sanitizeError } from '@/lib/sanitize';
import { getHandler } from './handlers';
import { EMAIL_JOB_TYPES } from './jobs';
import { getTransports, type Transports } from './transports';
import { log } from '@/lib/log';

export const BACKOFF_BASE_MS = 60_000;
export const BACKOFF_MAX_MS = 60 * 60_000;
/** A job stuck in PROCESSING longer than this (crashed worker) is picked up again. */
export const LOCK_TIMEOUT_MINUTES = 10;
/** Upper bound for one processing run (cron / worker / manual). */
export const MAX_BATCH = 100;

/** Exponential backoff: 1, 2, 4, 8 … minutes, capped at 1 hour. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);
}

/** Atomically claims due jobs (safe with several workers: FOR UPDATE SKIP LOCKED). */
export async function claimJobs(db: PrismaClient, opts: { ids?: string[]; limit?: number } = {}): Promise<IntegrationJob[]> {
  const limit = Math.min(Math.max(1, opts.limit ?? 20), MAX_BATCH);
  const idFilter = opts.ids?.length ? Prisma.sql`AND "id" IN (${Prisma.join(opts.ids)})` : Prisma.empty;
  return db.$queryRaw<IntegrationJob[]>`
    UPDATE "IntegrationJob"
    SET "status" = 'PROCESSING', "lockedAt" = now(), "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "IntegrationJob"
      WHERE (
        -- 1 s tolerance: nextAttemptAt is stored with ms precision (may round up) and can come
        -- from the app clock; without it a job created a moment ago could be skipped.
        ("status" = 'PENDING' AND "nextAttemptAt" <= now() + interval '1 second')
        OR ("status" = 'PROCESSING' AND "lockedAt" < now() - make_interval(mins => ${LOCK_TIMEOUT_MINUTES}::int))
      )
      ${idFilter}
      ORDER BY "createdAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}

export interface OutboxRunResult {
  claimed: number;
  completed: number;
  retrying: number;
  failed: number;
}

export async function runJob(db: PrismaClient, job: IntegrationJob, transports: Transports): Promise<'completed' | 'retrying' | 'failed'> {
  const handler = getHandler(job.type);
  try {
    if (!handler) throw new Error(`Unknown job type ${job.type}`);
    // An email already accepted by the provider (worker crashed before marking the job
    // done) is not sent again.
    if (!(job.providerRef && EMAIL_JOB_TYPES.has(job.type))) {
      const ref = await handler(db, job, transports);
      // Record delivery first, separately — this narrows the at-least-once window.
      if (ref) await db.integrationJob.update({ where: { id: job.id }, data: { providerRef: ref.slice(0, 500) } });
    }
    await db.integrationJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completedAt: new Date(), lockedAt: null, lastError: null },
    });
    return 'completed';
  } catch (error) {
    const lastError = sanitizeError(error);
    const exhausted = !handler || job.attempts >= job.maxAttempts;
    await db.integrationJob.update({
      where: { id: job.id },
      data: exhausted
        ? { status: 'FAILED', lockedAt: null, lastError }
        : { status: 'PENDING', lockedAt: null, lastError, nextAttemptAt: new Date(Date.now() + backoffMs(job.attempts)) },
    });
    log.warn(exhausted ? 'outbox.job.failed' : 'outbox.job.retry', { jobId: job.id, type: job.type, attempt: job.attempts, lastError });
    return exhausted ? 'failed' : 'retrying';
  }
}

export async function processOutbox(
  db: PrismaClient,
  opts: { ids?: string[]; limit?: number; transports?: Transports } = {},
): Promise<OutboxRunResult> {
  const transports = opts.transports ?? getTransports();
  const jobs = await claimJobs(db, opts);
  const result: OutboxRunResult = { claimed: jobs.length, completed: 0, retrying: 0, failed: 0 };
  for (const job of jobs) {
    result[await runJob(db, job, transports)]++;
  }
  return result;
}

/** Manual retry from the CRM: resets the attempt budget and makes the job due now. */
export async function requeueJob(db: PrismaClient, id: string): Promise<boolean> {
  const { count } = await db.integrationJob.updateMany({
    where: { id, status: { in: ['FAILED', 'PENDING'] } },
    data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lockedAt: null },
  });
  return count === 1;
}

/** Deletes completed jobs older than the retention period. Failed jobs are kept for review. */
export async function cleanupCompletedJobs(db: PrismaClient, retentionDays: number): Promise<number> {
  const days = Math.max(1, Math.floor(retentionDays));
  const { count } = await db.integrationJob.deleteMany({
    where: { status: 'COMPLETED', completedAt: { lt: new Date(Date.now() - days * 86_400_000) } },
  });
  return count;
}
