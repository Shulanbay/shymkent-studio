import 'server-only';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/lib/activity';
import { keyedHash } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';
import { getAuthSecret } from '@/lib/env';
import { clientIpFromHeaders, isSameOriginRequest, jsonError, readJsonBody } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rate-limit';
import { HTTP_STATUS, publicMessage, type PublicErrorCode, type PublicLang, pickLang } from './messages';
import { isHoneypotTriggered } from './schemas';
import { log } from '@/lib/log';

export const PUBLIC_LIMITS = {
  booking: { limit: 5, windowSeconds: 10 * 60 },
  tour: { limit: 5, windowSeconds: 10 * 60 },
  availability: { limit: 60, windowSeconds: 60 },
} as const;

export function publicError(code: PublicErrorCode, lang: PublicLang, extra?: Record<string, unknown>) {
  return jsonError(HTTP_STATUS[code], code, publicMessage(code, lang), extra);
}

/**
 * When no proxy supplies the client IP, all visitors share one bucket. A small
 * per-IP limit would then let five requests block everyone, so the shared
 * bucket gets a larger limit. Deploy behind a proxy that sets X-Forwarded-For.
 */
export const UNKNOWN_IP_MULTIPLIER = 20;
let warnedUnknownIp = false;

/** Per-IP rate limit; the IP is stored only as a keyed hash. */
export async function checkPublicRateLimit(request: Request, scope: keyof typeof PUBLIC_LIMITS) {
  const { limit, windowSeconds } = PUBLIC_LIMITS[scope];
  const ip = clientIpFromHeaders(request.headers);
  if (ip === 'unknown' && !warnedUnknownIp) {
    warnedUnknownIp = true;
    log.warn('rate_limit.client_ip_unknown', { hint: 'deploy behind a proxy that sets X-Forwarded-For, see TRUSTED_PROXY_COUNT' });
  }
  const effectiveLimit = ip === 'unknown' ? limit * UNKNOWN_IP_MULTIPLIER : limit;
  const ipHash = keyedHash(getAuthSecret(), ip);
  return consumeRateLimit(prisma, `${scope}:ip:${ipHash}`, effectiveLimit, windowSeconds);
}

/**
 * Shared front door for public POST forms: same-origin check, rate limit,
 * body size cap, honeypot. Returns the parsed body or an error response.
 */
export async function guardPublicPost(
  request: NextRequest,
  scope: 'booking' | 'tour',
): Promise<{ body: Record<string, unknown>; lang: PublicLang } | { response: Response }> {
  if (!isSameOriginRequest(request)) return { response: publicError('FORBIDDEN', 'ru') };

  const limit = await checkPublicRateLimit(request, scope);
  if (!limit.allowed) {
    return { response: publicError('RATE_LIMITED', 'ru', { retryAfterSeconds: limit.retryAfterSeconds }) };
  }

  const body = await readJsonBody(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { response: publicError('VALIDATION', 'ru') };
  const record = body as Record<string, unknown>;
  const lang = pickLang(record.locale);

  if (isHoneypotTriggered(record)) {
    await logActivity(prisma, { entityType: 'Spam', action: `spam.honeypot.${scope}` });
    return { response: publicError('REJECTED', lang) };
  }
  return { body: record, lang };
}
