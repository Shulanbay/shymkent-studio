/* eslint-disable no-console */
import { existsSync, rmSync } from 'node:fs';
import { parsePgUrl, psql } from '../scripts/lib/pg';
import { STATE_FILE, readState } from './env';

// Stops the E2E server and drops only the temporary E2E database (all data the
// run created lives there). The dev and production databases are never touched.
export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) return;
  const state = readState();
  if (state.serverPid) {
    try {
      process.kill(-state.serverPid, 'SIGTERM');
    } catch {
      try {
        process.kill(state.serverPid, 'SIGTERM');
      } catch {
        // already stopped
      }
    }
  }
  await new Promise((r) => setTimeout(r, 1000));
  if (process.env.E2E_KEEP_DB !== '1' && /^shymkent_e2e_[0-9a-z]+$/.test(state.databaseName)) {
    const server = parsePgUrl(process.env.DATABASE_URL_TEST, 'DATABASE_URL_TEST');
    psql(server, server.database, `DROP DATABASE IF EXISTS "${state.databaseName}" WITH (FORCE)`);
    console.log(`[e2e] dropped ${state.databaseName}`);
  }
  rmSync(STATE_FILE, { force: true });
}
