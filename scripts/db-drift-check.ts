/* eslint-disable no-console */
// Schema drift check: applies every migration to a brand-new temporary
// database and compares the result with prisma/schema.prisma. Fails if they
// differ (someone changed the schema without a migration, or edited a
// migration). Uses the server of DATABASE_URL_TEST (fallback DATABASE_URL);
// only a database named drift_check_<time> is created and dropped.
//
//   npm run db:drift

import { spawnSync } from 'node:child_process';
import { parsePgUrl, psql, timestamp, urlForDatabase } from './lib/pg';

function main() {
  const name = process.env.DATABASE_URL_TEST ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
  const server = parsePgUrl(process.env[name], name);
  const temp = `drift_check_${timestamp().toLowerCase().replace(/[^0-9a-z]/g, '')}`;
  psql(server, server.database, `CREATE DATABASE "${temp}"`);
  try {
    const url = urlForDatabase(server, temp);
    const env = { ...process.env, DATABASE_URL: url };
    const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { env, encoding: 'utf8' });
    if (deploy.status !== 0) throw new Error(`migrations failed on a clean database:\n${deploy.stdout}\n${deploy.stderr}`);
    console.log('✓ all migrations apply to a clean database');
    const diff = spawnSync(
      'npx',
      ['prisma', 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'],
      { env, encoding: 'utf8' },
    );
    if (diff.status === 0) console.log('✓ no drift: migrations match prisma/schema.prisma');
    else if (diff.status === 2) throw new Error(`schema drift detected:\n${diff.stdout}`);
    else throw new Error(`prisma migrate diff failed:\n${diff.stderr}`);
  } finally {
    psql(server, server.database, `DROP DATABASE IF EXISTS "${temp}" WITH (FORCE)`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Drift check FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
