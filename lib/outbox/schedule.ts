import 'server-only';
import { after } from 'next/server';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { processOutbox } from './process';

/**
 * Runs freshly enqueued jobs right after the response is sent. `after()` keeps
 * serverless functions (Vercel) alive until it finishes and works the same on a
 * long-running Node server. Jobs that do not finish here — crash, outage,
 * timeout — stay in the table and are picked up by /api/cron/outbox or
 * `npm run outbox:worker`. Never throws.
 */
export function scheduleOutboxProcessing(ids: string[]): void {
  // Tests drive the outbox explicitly; dry-run (INTEGRATIONS_DRY_RUN) still processes via the recorder.
  if (ids.length === 0 || process.env.VITEST) return;
  try {
    after(async () => {
      try {
        await processOutbox(prisma, { ids });
      } catch (error) {
        log.error('outbox.inline_failed', { error });
      }
    });
  } catch {
    // Outside a request scope: the cron / worker will process the jobs.
  }
}
