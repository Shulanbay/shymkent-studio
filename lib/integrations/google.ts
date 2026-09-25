import 'server-only';
import { google } from 'googleapis';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { getAuthSecret, getSiteUrl } from '@/lib/env';
import { SETTING_KEYS, writeSetting } from '@/lib/settings';
import { log } from '@/lib/log';

/** Short-lived cookie carrying the OAuth `state` value (CSRF protection for the OAuth flow). */
export const GOOGLE_STATE_COOKIE = 'ss_google_oauth_state';

export const GOOGLE_OAUTH_SCOPES = ['https://www.googleapis.com/auth/calendar'];

// The redirect URI registered in Google Cloud Console. Kept at the historical
// path so existing OAuth client configuration keeps working.
export function googleRedirectUri(): string {
  return `${getSiteUrl()}/api/auth/callback`;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, googleRedirectUri());
}

const storedSchema = z.object({
  refreshTokenEnc: z.string(),
  connectedAt: z.string(),
  connectedById: z.string().nullable(),
});

export async function storeGoogleRefreshToken(refreshToken: string, userId: string) {
  await writeSetting(
    prisma,
    SETTING_KEYS.googleIntegration,
    {
      refreshTokenEnc: encryptSecret(refreshToken, getAuthSecret()),
      connectedAt: new Date().toISOString(),
      connectedById: userId,
    },
    userId,
  );
}

export async function getGoogleConnectionStatus(): Promise<{ source: 'database' | 'env' | 'none'; connectedAt?: string }> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.googleIntegration } });
  const parsed = storedSchema.safeParse(row?.value);
  if (parsed.success) return { source: 'database', connectedAt: parsed.data.connectedAt };
  if (process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) return { source: 'env' };
  return { source: 'none' };
}

/**
 * Refresh token for server-side Calendar calls. Prefers the token saved via
 * the owner-only OAuth flow; falls back to GOOGLE_CALENDAR_REFRESH_TOKEN.
 * Never send the returned value to a browser.
 */
export async function getGoogleRefreshToken(): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.googleIntegration } });
    const parsed = storedSchema.safeParse(row?.value);
    if (parsed.success) return decryptSecret(parsed.data.refreshTokenEnc, getAuthSecret());
  } catch {
    log.warn('google.stored_token_unavailable', { fallback: 'GOOGLE_CALENDAR_REFRESH_TOKEN' });
  }
  return process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || null;
}
