/* eslint-disable no-console */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parsePgUrl, psql, timestamp, urlForDatabase } from '../scripts/lib/pg';
import { E2E_PORT, STATE_FILE, type E2EState } from './env';

// Builds an isolated environment: its own database (never the dev or production
// one), fake integration credentials and INTEGRATIONS_DRY_RUN=true, so nothing
// can reach real email / Google services.

function secret() {
  return randomBytes(36).toString('base64url');
}

async function waitFor(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

export function serverEnv(state: Pick<E2EState, 'databaseUrl' | 'cronSecret'>, authSecret: string): NodeJS.ProcessEnv {
  const base = `http://localhost:${E2E_PORT}`;
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'production',
    APP_ENV: 'local',
    NEXT_DIST_DIR: '.next-e2e',
    NEXT_TELEMETRY_DISABLED: '1',
    DATABASE_URL: state.databaseUrl,
    AUTH_SECRET: authSecret,
    AUTH_URL: base,
    NEXT_PUBLIC_SITE_URL: base,
    CRON_SECRET: state.cronSecret,
    INTEGRATIONS_DRY_RUN: 'true',
    // Next.js also reads .env.local; explicitly empty values keep real credentials out of the E2E server.
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    GOOGLE_CALENDAR_REFRESH_TOKEN: '',
    // Fake credentials: jobs are planned exactly like in production, the dry-run recorder executes them.
    GMAIL_USER: 'robot@example.test',
    GMAIL_APP_PASSWORD: 'not-a-real-password',
    ADMIN_NOTIFICATION_EMAIL: 'admin@example.test',
    GOOGLE_CLIENT_ID: 'e2e-client-id',
    GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
    GOOGLE_CALENDAR_ID: 'e2e-calendar@example.test',
    GOOGLE_APPS_SCRIPT_URL: 'https://example.invalid/sheets',
    TRUSTED_PROXY_COUNT: '1',
    LOG_LEVEL: 'warn',
  };
}

export default async function globalSetup() {
  const inUse = await fetch(`http://localhost:${E2E_PORT}/api/health`).then(
    () => true,
    () => false,
  );
  if (inUse) throw new Error(`Port ${E2E_PORT} is busy. Stop the process using it and retry.`);

  const server = parsePgUrl(process.env.DATABASE_URL_TEST, 'DATABASE_URL_TEST');
  const databaseName = `shymkent_e2e_${timestamp().toLowerCase().replace(/[^0-9a-z]/g, '')}`;
  psql(server, server.database, `CREATE DATABASE "${databaseName}"`);
  const databaseUrl = urlForDatabase(server, databaseName);

  const state: E2EState = {
    databaseUrl,
    databaseName,
    ownerEmail: 'owner-e2e@example.test',
    ownerPassword: `E2e-Owner-${secret().slice(0, 16)}`,
    cronSecret: secret(),
  };
  mkdirSync(path.dirname(STATE_FILE), { recursive: true, mode: 0o700 });
  writeFileSync(STATE_FILE, JSON.stringify(state), { mode: 0o600 });

  const authSecret = secret();
  const env = serverEnv(state, authSecret);
  const run = (cmd: string, args: string[], extra: Record<string, string> = {}) => {
    const r = spawnSync(cmd, args, { env: { ...env, ...extra }, stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
  };

  console.log(`[e2e] database ${databaseName}: migrate + seed`);
  run('npx', ['prisma', 'migrate', 'deploy']);
  run('npx', ['tsx', 'prisma/seed.ts'], { OWNER_EMAIL: state.ownerEmail, OWNER_INITIAL_PASSWORD: state.ownerPassword, OWNER_NAME: 'E2E Владелец' });

  if (!(process.env.E2E_REUSE_BUILD === '1' && existsSync('.next-e2e/BUILD_ID'))) {
    console.log('[e2e] production build (.next-e2e)');
    run('npx', ['next', 'build']);
  }

  console.log(`[e2e] starting server on :${E2E_PORT}`);
  const log = openSync(path.resolve('e2e/.auth/server.log'), 'w');
  const child = spawn('npx', ['next', 'start', '-p', String(E2E_PORT)], { env, stdio: ['ignore', log, log], detached: true });
  child.unref();
  state.serverPid = child.pid;
  writeFileSync(STATE_FILE, JSON.stringify(state), { mode: 0o600 });
  await waitFor(`http://localhost:${E2E_PORT}/api/ready`, 60_000);
}
