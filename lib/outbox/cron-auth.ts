import { safeEqual } from '@/lib/auth/tokens';

/** Constant-time check of "Authorization: Bearer <CRON_SECRET>". Disabled when the secret is missing or shorter than 32 characters. */
export function isAuthorizedCron(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header) return false;
  return safeEqual(header, `Bearer ${secret}`);
}
