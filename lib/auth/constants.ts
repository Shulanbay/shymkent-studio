// Edge-safe constants (imported by middleware — keep free of Node APIs).

/** Cookie used over plain HTTP (local development). */
export const SESSION_COOKIE = 'ss_admin';
/** Cookie used over HTTPS. The __Host- prefix forces Secure, Path=/ and no Domain. */
export const SECURE_SESSION_COOKIE = '__Host-ss_admin';

/** Session ends after this long without activity. */
export const SESSION_IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
/** Session ends this long after sign-in regardless of activity. */
export const SESSION_ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
/** lastUsedAt / expiresAt are refreshed at most this often. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const LOGIN_PATH = '/admin/login';
