// Helpers for the database maintenance scripts. Connection details are passed
// to pg_dump / pg_restore / psql through PG* environment variables, never on
// the command line (so passwords do not appear in `ps` or shell history).

import { spawnSync } from 'node:child_process';

export interface PgConn {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  sslmode?: string;
}

export function parsePgUrl(url: string | undefined, label = 'DATABASE_URL'): PgConn {
  if (!url) throw new Error(`${label} is not set`);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) throw new Error(`${label} must be a postgresql:// URL`);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(database)) throw new Error(`${label}: unexpected database name`);
  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    sslmode: parsed.searchParams.get('sslmode') ?? undefined,
  };
}

export function pgEnv(conn: PgConn, database = conn.database): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGHOST: conn.host,
    PGPORT: conn.port,
    PGUSER: conn.user,
    PGPASSWORD: conn.password,
    PGDATABASE: database,
    ...(conn.sslmode ? { PGSSLMODE: conn.sslmode } : {}),
  };
}

/** A postgresql:// URL for another database on the same server (for Prisma). */
export function urlForDatabase(conn: PgConn, database: string): string {
  const auth = conn.user ? `${encodeURIComponent(conn.user)}${conn.password ? `:${encodeURIComponent(conn.password)}` : ''}@` : '';
  const params = new URLSearchParams({ schema: 'public', ...(conn.sslmode ? { sslmode: conn.sslmode } : {}) });
  return `postgresql://${auth}${conn.host}:${conn.port}/${database}?${params}`;
}

export function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): string {
  const result = spawnSync(cmd, args, { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`${cmd} could not be started: ${result.error.message}. Is the PostgreSQL client installed?`);
  if (result.status !== 0) {
    // stderr of pg tools contains no password (it is passed via PGPASSWORD).
    throw new Error(`${cmd} failed (exit ${result.status}): ${result.stderr.trim().split('\n').slice(-5).join(' | ')}`);
  }
  return result.stdout;
}

export function psql(conn: PgConn, database: string, sql: string): string {
  return run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], pgEnv(conn, database)).trim();
}

export function timestamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15) + 'Z';
}
