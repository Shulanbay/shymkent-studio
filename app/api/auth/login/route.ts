import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { requireApiPermission } from '@/lib/auth/session';
import { isHttpsSite } from '@/lib/env';
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_STATE_COOKIE,
  createGoogleOAuthClient,
  isGoogleOAuthConfigured,
} from '@/lib/integrations/google';

export const dynamic = 'force-dynamic';

// Starts the Google Calendar OAuth flow. OWNER only.
export async function GET(request: NextRequest) {
  const auth = await requireApiPermission('integrations:manage');
  if (auth.response) {
    // A signed-out owner opening this link should land on the login page.
    return auth.response.status === 401
      ? NextResponse.redirect(new URL('/admin/login?next=/admin/settings', request.url))
      : auth.response;
  }
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL('/admin/settings?google=not_configured', request.url));
  }

  const state = randomBytes(24).toString('base64url');
  const authUrl = createGoogleOAuthClient().generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_OAUTH_SCOPES,
    prompt: 'consent',
    state,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isHttpsSite(),
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 10 * 60,
  });
  return response;
}
