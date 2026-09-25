import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/env';

/**
 * CSRF protection for state-changing public/admin Route Handlers: the request
 * must carry an Origin header equal to this site. Browsers always send Origin
 * on cross-origin and same-origin POST requests made with fetch().
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([getSiteUrl()]);
  const host = request.headers.get('host');
  if (host) {
    allowed.add(`https://${host}`);
    if (process.env.NODE_ENV !== 'production') allowed.add(`http://${host}`);
  }
  return allowed.has(origin);
}

/**
 * Client IP for rate limiting, taken from the reverse proxy in front of the app
 * (Vercel, nginx, Caddy). X-Forwarded-For is "client, proxy1, proxy2": entries
 * added by trusted proxies are at the end, anything before them may be forged by
 * the client. TRUSTED_PROXY_COUNT (default 1) = how many proxies append to it;
 * 0 = no proxy, headers are ignored. Without a proxy, limits are best-effort.
 */
export function clientIpFromHeaders(headers: Headers, env: Record<string, string | undefined> = process.env): string {
  const raw = Number(env.TRUSTED_PROXY_COUNT ?? '1');
  const hops = Number.isInteger(raw) && raw >= 0 && raw <= 10 ? raw : 1;
  if (hops === 0) return 'unknown';
  const chain = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const fromChain = chain.length ? chain[Math.max(0, chain.length - hops)] : undefined;
  const ip = fromChain || headers.get('x-real-ip')?.trim() || '';
  // Only IPv4/IPv6 characters; anything else is treated as unknown.
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : 'unknown';
}

/** Reads a JSON body with a size cap. Returns undefined for oversized or invalid JSON. */
export async function readJsonBody(request: Request, maxBytes = 16 * 1024): Promise<unknown | undefined> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return undefined;
  const text = await request.text();
  if (text.length > maxBytes) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function jsonError(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
}
