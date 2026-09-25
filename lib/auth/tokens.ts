import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256-bit random token, URL-safe. Goes into the session cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only the hash is stored in the database, so a DB leak does not leak live sessions. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Keyed hash for identifiers we must not store in clear text (IPs, emails in rate-limit keys). */
export function keyedHash(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url').slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
