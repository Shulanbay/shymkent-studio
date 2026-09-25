import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isHttpsSite } from '@/lib/env';
import { clientIpFromHeaders } from '@/lib/http';
import { LOGIN_PATH, SECURE_SESSION_COOKIE, SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_COOKIE } from './constants';
import { hasPermission, type Permission } from './permissions';
import { validateSessionToken, type SessionUser } from './service';

export function sessionCookieName(): string {
  return isHttpsSite() ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

/** Only callable from Server Actions and Route Handlers. */
export async function setSessionCookie(token: string) {
  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    secure: isHttpsSite(),
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000),
  });
}

export async function clearSessionCookie() {
  (await cookies()).set(sessionCookieName(), '', {
    httpOnly: true,
    secure: isHttpsSite(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

export async function getUserAgent(): Promise<string | null> {
  return (await headers()).get('user-agent');
}

/** Current staff user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  return validateSessionToken(prisma, await readSessionToken());
});

// ─── Guards for Server Components and Server Actions ─────────────────────────

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) redirect('/admin/forbidden');
  return user;
}

/** For Server Actions: throws instead of redirecting, so callers can return an error state. */
export class AuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? 'Требуется вход' : 'Недостаточно прав');
  }
}

export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError(401);
  if (!hasPermission(user.role, permission)) throw new AuthorizationError(403);
  return user;
}

// ─── Guards for Route Handlers ───────────────────────────────────────────────

export type ApiAuthResult = { user: SessionUser; response?: never } | { user?: never; response: NextResponse };

export async function requireApiPermission(permission: Permission): Promise<ApiAuthResult> {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!hasPermission(user.role, permission)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

export { isSameOriginRequest } from '@/lib/http';
