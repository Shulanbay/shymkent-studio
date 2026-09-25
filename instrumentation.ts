// Runs once when the Next.js server starts. In production the server refuses
// to start with an invalid or unsafe configuration (short secrets, localhost
// URLs, half-configured integrations) instead of failing later on a request.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { validateEnv } = await import('./lib/env-schema');
  const { log } = await import('./lib/log');
  const report = validateEnv();
  for (const warning of report.warnings) log.warn('config.warning', { warning });
  if (report.errors.length) {
    for (const problem of report.errors) log.error('config.error', { problem });
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Invalid environment configuration (${report.errors.length} problem(s)); see the log above and docs/DEPLOYMENT.md`);
    }
  }
  log.info('server.start', { integrations: report.integrations, dryRun: process.env.INTEGRATIONS_DRY_RUN === 'true' });
}
