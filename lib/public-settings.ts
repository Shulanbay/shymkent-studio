import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db';
import { DEFAULT_CANCELLATION_POLICY, type CancellationPolicy } from '@/lib/policy';
import { getCancellationPolicy } from '@/lib/settings';
import { log } from '@/lib/log';

export const SETTINGS_CACHE_TAG = 'settings';

const cachedPolicy = unstable_cache(() => getCancellationPolicy(prisma), ['cancellation-policy'], {
  tags: [SETTINGS_CACHE_TAG],
  revalidate: 300,
});

/**
 * Policy for rendering public pages. Never throws: if the database is not
 * reachable (e.g. during a build without DB access) the defaults are shown,
 * and nothing is cached so the real value is picked up on the next render.
 */
export async function getPublicCancellationPolicy(): Promise<CancellationPolicy> {
  if (!process.env.DATABASE_URL) return DEFAULT_CANCELLATION_POLICY;
  try {
    return await cachedPolicy();
  } catch {
    log.warn('settings.db_unavailable', { fallback: 'default cancellation policy' });
    return DEFAULT_CANCELLATION_POLICY;
  }
}
