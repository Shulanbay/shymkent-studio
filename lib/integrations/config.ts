// Which optional integrations are configured. Reads the environment only.

export interface IntegrationConfig {
  email: boolean;
  adminEmail: string | null;
  calendar: boolean;
  sheets: boolean;
}

export function getIntegrationConfig(env: NodeJS.ProcessEnv = process.env): IntegrationConfig {
  const smtp = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
  const gmail = Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
  return {
    email: smtp || gmail,
    adminEmail: env.ADMIN_NOTIFICATION_EMAIL?.trim() || env.NEXT_PUBLIC_EMAIL?.trim() || null,
    calendar: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALENDAR_ID),
    sheets: Boolean(env.GOOGLE_APPS_SCRIPT_URL),
  };
}

/** Integrations never touch real services in tests or when explicitly disabled. */
export function isDryRun(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'test' || env.VITEST === 'true' || env.INTEGRATIONS_DRY_RUN === 'true';
}
