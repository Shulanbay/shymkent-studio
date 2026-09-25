import 'server-only';

// Server-side configuration. Values are read lazily so that `next build`
// works without runtime secrets; a missing required value fails loudly at
// the moment it is actually needed.

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

export function getAuthSecret(): string {
  const secret = required('AUTH_SECRET');
  if (secret.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters long');
  }
  return secret;
}

/** Public origin of the site, e.g. https://shymkent.studio (no trailing slash). */
export function getSiteUrl(): string {
  const raw = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/** Cookies get the Secure flag (and the __Host- prefix) whenever the site is served over HTTPS. */
export function isHttpsSite(): boolean {
  return getSiteUrl().startsWith('https://');
}
