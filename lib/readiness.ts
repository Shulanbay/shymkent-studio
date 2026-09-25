import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { validateEnv } from '@/lib/env-schema';

export type CheckState = 'ok' | 'error';

export interface Readiness {
  ready: boolean;
  checks: { database: CheckState; migrations: CheckState; config: CheckState };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

/**
 * Readiness for load balancers / deploy checks: database reachable, every
 * migration applied successfully, configuration valid. Returns states only —
 * never versions, error texts, schema details or data.
 */
export async function checkReadiness(db: PrismaClient, env: NodeJS.ProcessEnv = process.env): Promise<Readiness> {
  const checks: Readiness['checks'] = { database: 'error', migrations: 'error', config: 'error' };
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, 3000);
    checks.database = 'ok';
    const rows = await withTimeout(
      db.$queryRaw<{ unfinished: bigint; total: bigint }[]>`
        SELECT COUNT(*) FILTER (WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL) AS unfinished, COUNT(*) AS total
        FROM "_prisma_migrations"`,
      3000,
    );
    checks.migrations = Number(rows[0]?.total ?? 0) > 0 && Number(rows[0]?.unfinished ?? 1) === 0 ? 'ok' : 'error';
  } catch {
    // states stay "error"
  }
  checks.config = validateEnv(env).errors.length === 0 ? 'ok' : 'error';
  return { ready: Object.values(checks).every((c) => c === 'ok'), checks };
}
