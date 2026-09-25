import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/outbox/cron-auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { MAX_BATCH, cleanupCompletedJobs, processOutbox } from '@/lib/outbox/process';

export const dynamic = 'force-dynamic';
// One batch (≤ 100 jobs, each with a 15 s network timeout at most) fits comfortably.
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };

// Processes due outbox jobs (including stuck PROCESSING jobs after a worker
// crash) and cleans up old completed jobs. Call every minute from a scheduler
// with `Authorization: Bearer $CRON_SECRET`. Without the secret it answers 404.
async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore });
  }
  const requested = Number(request.nextUrl.searchParams.get('limit') ?? 50);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(1, Math.floor(requested)), MAX_BATCH) : 50;
  const result = await processOutbox(prisma, { limit });
  if (result.claimed > 0) log.info('outbox.cron.batch', { ...result });
  const cleaned = await cleanupCompletedJobs(prisma, Number(process.env.OUTBOX_RETENTION_DAYS || 30));
  // Housekeeping of other expiring rows.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return NextResponse.json({ ...result, cleaned }, { headers: noStore });
}

export const GET = handle;
export const POST = handle;
