// Environment validation. Pure module: used at server start (instrumentation.ts),
// by `npm run env:check`, and by tests. Never prints secret values.

export interface EnvReport {
  errors: string[];
  warnings: string[];
  /** Optional integrations that are fully configured. */
  integrations: { email: boolean; calendar: boolean; sheets: boolean };
}

const PLACEHOLDERS = [/^change[-_ ]?me/i, /^your[-_]/i, /^x{4,}/i, /^secret$/i, /^password$/i, /^test$/i, /replace/i, /example/i];

function isWeakSecret(value: string): boolean {
  return PLACEHOLDERS.some((re) => re.test(value)) || new Set(value).size < 10;
}

function parseUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalHost(url: URL): boolean {
  return ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.local');
}

const filled = (value: string | undefined) => Boolean(value && value.trim());

/**
 * `production` = the app serves real visitors (NODE_ENV=production and not a
 * local E2E/verification run, see APP_ENV). Stricter rules apply there.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = env.NODE_ENV === 'production' && env.APP_ENV !== 'local';

  // ─── Database ───────────────────────────────────────────────────────────────
  const db = parseUrl(env.DATABASE_URL);
  if (!filled(env.DATABASE_URL)) errors.push('DATABASE_URL is required (PostgreSQL connection string).');
  else if (!db || !/^postgres(ql)?:$/.test(db.protocol)) errors.push('DATABASE_URL must be a postgresql:// URL.');

  // ─── Auth ───────────────────────────────────────────────────────────────────
  const secret = env.AUTH_SECRET ?? '';
  if (!filled(secret)) errors.push('AUTH_SECRET is required (≥ 32 random characters).');
  else if (secret.length < 32) errors.push('AUTH_SECRET must be at least 32 characters long.');
  else if (production && isWeakSecret(secret)) errors.push('AUTH_SECRET looks like a placeholder; generate a random value.');

  const authUrl = parseUrl(env.AUTH_URL);
  const siteUrl = parseUrl(env.NEXT_PUBLIC_SITE_URL);
  if (filled(env.AUTH_URL) && !authUrl) errors.push('AUTH_URL is not a valid URL.');
  if (filled(env.NEXT_PUBLIC_SITE_URL) && !siteUrl) errors.push('NEXT_PUBLIC_SITE_URL is not a valid URL.');
  if (production) {
    if (!authUrl) errors.push('AUTH_URL is required in production (e.g. https://shymkent.studio).');
    else if (authUrl.protocol !== 'https:' || isLocalHost(authUrl)) errors.push('AUTH_URL must be a public https:// address in production.');
    if (!siteUrl) errors.push('NEXT_PUBLIC_SITE_URL is required in production (e.g. https://shymkent.studio).');
    else if (siteUrl.protocol !== 'https:' || isLocalHost(siteUrl)) errors.push('NEXT_PUBLIC_SITE_URL must be a public https:// address in production.');
    if (authUrl && siteUrl && authUrl.origin !== siteUrl.origin) {
      warnings.push('AUTH_URL and NEXT_PUBLIC_SITE_URL point to different origins; links in emails and cookies use AUTH_URL.');
    }
    if (filled(env.OWNER_INITIAL_PASSWORD)) {
      warnings.push('OWNER_INITIAL_PASSWORD is still set; remove it after the first login.');
    }
  }

  // ─── Cron / outbox ──────────────────────────────────────────────────────────
  const cron = env.CRON_SECRET ?? '';
  if (filled(cron) && cron.length < 32) errors.push('CRON_SECRET must be at least 32 characters long.');
  else if (filled(cron) && production && isWeakSecret(cron)) errors.push('CRON_SECRET looks like a placeholder; generate a random value.');
  if (production && !filled(cron)) errors.push('CRON_SECRET is required in production (retries of emails / Calendar / Sheets run via /api/cron/outbox).');
  if (filled(cron) && cron === secret) errors.push('CRON_SECRET must differ from AUTH_SECRET.');
  for (const name of ['OUTBOX_INTERVAL_SECONDS', 'OUTBOX_RETENTION_DAYS', 'SMTP_PORT', 'TRUSTED_PROXY_COUNT'] as const) {
    if (filled(env[name]) && !/^\d+$/.test(env[name]!.trim())) errors.push(`${name} must be a whole number.`);
  }

  // ─── Email ──────────────────────────────────────────────────────────────────
  const smtpParts = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'].filter((k) => filled(env[k]));
  if (smtpParts.length > 0 && smtpParts.length < 3) {
    errors.push('SMTP is partly configured: set SMTP_HOST, SMTP_USER and SMTP_PASSWORD together (or none).');
  }
  if (filled(env.GMAIL_USER) !== filled(env.GMAIL_APP_PASSWORD)) {
    errors.push('Gmail is partly configured: set GMAIL_USER and GMAIL_APP_PASSWORD together (or none).');
  }
  const email = smtpParts.length === 3 || (filled(env.GMAIL_USER) && filled(env.GMAIL_APP_PASSWORD));
  if (email && !filled(env.ADMIN_NOTIFICATION_EMAIL) && !filled(env.NEXT_PUBLIC_EMAIL)) {
    warnings.push('Email is configured but ADMIN_NOTIFICATION_EMAIL is empty: staff will not be notified about new requests.');
  }
  if (production && !email) warnings.push('No email provider configured: clients and staff receive no emails.');

  // ─── Google ─────────────────────────────────────────────────────────────────
  if (filled(env.GOOGLE_CLIENT_ID) !== filled(env.GOOGLE_CLIENT_SECRET)) {
    errors.push('Google OAuth is partly configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET together.');
  }
  if (filled(env.GOOGLE_CALENDAR_ID) && !(filled(env.GOOGLE_CLIENT_ID) && filled(env.GOOGLE_CLIENT_SECRET))) {
    errors.push('GOOGLE_CALENDAR_ID is set but GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are missing.');
  }
  const calendar = filled(env.GOOGLE_CLIENT_ID) && filled(env.GOOGLE_CLIENT_SECRET) && filled(env.GOOGLE_CALENDAR_ID);
  const sheetsUrl = parseUrl(env.GOOGLE_APPS_SCRIPT_URL);
  if (filled(env.GOOGLE_APPS_SCRIPT_URL) && (!sheetsUrl || sheetsUrl.protocol !== 'https:')) {
    errors.push('GOOGLE_APPS_SCRIPT_URL must be an https:// Apps Script web-app URL.');
  }

  if (production && env.INTEGRATIONS_DRY_RUN === 'true') {
    warnings.push('INTEGRATIONS_DRY_RUN=true: no real emails / Calendar / Sheets calls are made (staging mode).');
  }

  return { errors, warnings, integrations: { email, calendar, sheets: Boolean(sheetsUrl) } };
}

/** Throws one readable error listing every problem (used at server start). */
export function assertValidEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const report = validateEnv(env);
  if (report.errors.length) {
    throw new Error(`Invalid environment configuration:\n  - ${report.errors.join('\n  - ')}\nSee .env.example and docs/DEPLOYMENT.md.`);
  }
  return report;
}
