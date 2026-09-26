import { NextResponse, type NextRequest } from 'next/server';
import { LOGIN_PATH, SECURE_SESSION_COOKIE, SESSION_COOKIE } from '@/lib/auth/constants';

// 1. Every request gets a correlation id (X-Request-Id), passed to the server
//    code and returned in the response, so a visitor's error can be matched
//    with a server log line.
// 2. First line of defence for the CRM: visitors without a session cookie are
//    redirected away from /admin. Cookie validity, expiry, user status and role
//    are verified on the server by every admin page, action and API handler
//    (lib/auth/session.ts), because middleware runs on the Edge without DB access.

const REQUEST_ID = 'x-request-id';

function requestId(request: NextRequest): string {
  const incoming = request.headers.get(REQUEST_ID);
  return incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
}

function isPrivatePath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin') || pathname.startsWith('/api/auth/');
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const id = requestId(request);

  if (isPrivatePath(pathname)) {
    const hasSessionCookie = request.cookies.has(SESSION_COOKIE) || request.cookies.has(SECURE_SESSION_COOKIE);
    // The sign-in page and the email-link page (/admin/login/verify) are reachable without a session.
    const isLoginPage = pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
    if (!hasSessionCookie && !isLoginPage) {
      let response: NextResponse;
      if (pathname.startsWith('/api/admin')) {
        response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      } else if (pathname.startsWith('/api/auth/')) {
        // OAuth setup endpoints are opened by the browser, so send them to login too.
        response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
      } else {
        const url = new URL(LOGIN_PATH, request.url);
        const next = `${pathname}${search}`;
        if (next !== '/admin') url.searchParams.set('next', next);
        response = NextResponse.redirect(url);
      }
      response.headers.set(REQUEST_ID, id);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
  }

  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID, id);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID, id);
  if (isPrivatePath(pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

export const config = {
  // Everything except build assets and static files.
  matcher: ['/((?!_next/static|_next/image|images/|videos/|favicon.ico|icon.svg|opengraph-image).*)'],
};
