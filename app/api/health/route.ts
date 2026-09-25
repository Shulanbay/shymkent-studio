import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Liveness: the process is up and serving requests. No database access, no
// version or configuration details (safe to expose to any uptime monitor).
export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
