import { NextResponse, type NextRequest } from 'next/server';
import { logActivity } from '@/lib/activity';
import { requireApiPermission } from '@/lib/auth/session';
import { safeEqual } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';
import { GOOGLE_STATE_COOKIE, createGoogleOAuthClient, storeGoogleRefreshToken } from '@/lib/integrations/google';
import { log, requestIdOf } from '@/lib/log';

export const dynamic = 'force-dynamic';

// Google OAuth redirect target. OWNER only. The refresh token is encrypted and
// stored server-side; it is never included in any response.
export async function GET(request: NextRequest) {
  const auth = await requireApiPermission('integrations:manage');
  if (auth.response) return auth.response;

  const done = (status: string) => {
    const response = NextResponse.redirect(new URL(`/admin/settings?google=${status}`, request.url));
    response.cookies.set(GOOGLE_STATE_COOKIE, '', { path: '/api/auth', maxAge: 0 });
    return response;
  };

  const params = request.nextUrl.searchParams;
  const expectedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const state = params.get('state');
  if (!expectedState || !state || !safeEqual(expectedState, state)) return done('invalid_state');
  if (params.get('error')) return done('denied');

  const code = params.get('code');
  if (!code) return done('error');

  try {
    const { tokens } = await createGoogleOAuthClient().getToken(code);
    if (!tokens.refresh_token) return done('no_refresh_token');
    await storeGoogleRefreshToken(tokens.refresh_token, auth.user.id);
    await logActivity(prisma, {
      userId: auth.user.id,
      entityType: 'Integration',
      entityId: 'google',
      action: 'integration.google.connect',
    });
    return done('connected');
  } catch {
    log.error('google.oauth.exchange_failed', { requestId: requestIdOf(request.headers) });
    return done('error');
  }
}
