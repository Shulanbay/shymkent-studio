import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { checkReadiness } from '@/lib/readiness';

export const dynamic = 'force-dynamic';

// Readiness: 200 when the app can serve real traffic, 503 otherwise.
export async function GET() {
  const result = await checkReadiness(prisma);
  if (!result.ready) log.warn('readiness.failed', { checks: result.checks });
  return NextResponse.json(
    { status: result.ready ? 'ready' : 'not_ready', checks: result.checks },
    { status: result.ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
