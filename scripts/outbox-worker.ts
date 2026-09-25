/* eslint-disable no-console */
// Standalone outbox worker: processes due integration jobs in a loop.
// Run: npm run outbox:worker         (continuous, every OUTBOX_INTERVAL_SECONDS, default 30)
//      npm run outbox:worker -- --once
// Safe to run next to the web server or several copies at once (FOR UPDATE SKIP LOCKED).
// SIGTERM / SIGINT: the current batch finishes, then the process exits (graceful shutdown).

import { prisma } from '../lib/db';
import { log } from '../lib/log';
import { MAX_BATCH, cleanupCompletedJobs, processOutbox } from '../lib/outbox/process';

const once = process.argv.includes('--once');
const intervalMs = Math.max(5, Number(process.env.OUTBOX_INTERVAL_SECONDS || 30)) * 1000;
const retentionDays = Number(process.env.OUTBOX_RETENTION_DAYS || 30);
let stopping = false;
let wake: (() => void) | null = null;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    wake = () => {
      clearTimeout(timer);
      resolve();
    };
  });
}

async function tick(iteration: number) {
  const result = await processOutbox(prisma, { limit: Math.min(50, MAX_BATCH) });
  if (result.claimed > 0) log.info('outbox.worker.batch', { ...result });
  // Housekeeping about once an hour.
  if (iteration % Math.max(1, Math.round(3_600_000 / intervalMs)) === 0) {
    const cleaned = await cleanupCompletedJobs(prisma, retentionDays);
    await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
    if (cleaned > 0) log.info('outbox.worker.cleanup', { cleaned });
  }
}

async function main() {
  log.info('outbox.worker.start', { once, intervalSeconds: intervalMs / 1000 });
  let iteration = 0;
  while (!stopping) {
    try {
      await tick(iteration++);
    } catch (error) {
      log.error('outbox.worker.tick_failed', { error });
      if (once) process.exitCode = 1;
    }
    if (once || stopping) break;
    await sleep(intervalMs);
  }
  await prisma.$disconnect();
  log.info('outbox.worker.stop');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (stopping) process.exit(1); // second signal: stop immediately
    stopping = true;
    log.info('outbox.worker.stopping', { signal });
    wake?.();
  });
}

main().catch((error) => {
  log.error('outbox.worker.crashed', { error });
  process.exit(1);
});
