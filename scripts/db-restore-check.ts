/* eslint-disable no-console */
// Proves that a backup can be restored: restores it into a brand-new temporary
// database, checks the schema and data, and drops the temporary database.
//
//   npm run db:restore-check                        → newest file in BACKUP_DIR (default backups/)
//   npm run db:restore-check -- backups/x.dump
//
// Target server: RESTORE_CHECK_DATABASE_URL if set (recommended: a non-production
// server), otherwise the server of DATABASE_URL. Only a database named
// restore_check_<time> is ever created and dropped; the source database is never
// written to, and the script refuses to run if the names could collide.

import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parsePgUrl, pgEnv, psql, run, timestamp } from './lib/pg';

const TEMP_PREFIX = 'restore_check_';

function latestBackup(dir: string): string {
  if (!existsSync(dir)) throw new Error(`No backup directory ${dir}. Run npm run db:backup first.`);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.dump'))
    .map((f) => path.join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!files.length) throw new Error(`No .dump files in ${dir}. Run npm run db:backup first.`);
  return files[0];
}

function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (c) => hash.update(c))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

async function main() {
  const file = path.resolve(process.argv[2] || latestBackup(path.resolve(process.env.BACKUP_DIR || 'backups')));
  if (!existsSync(file)) throw new Error(`Backup not found: ${file}`);

  if (existsSync(`${file}.sha256`)) {
    const expected = readFileSync(`${file}.sha256`, 'utf8').split(/\s+/)[0];
    if ((await sha256(file)) !== expected) throw new Error('Checksum mismatch: the backup file is damaged or was modified');
    console.log('✓ checksum matches');
  } else {
    console.log('! no .sha256 file next to the backup — checksum not verified');
  }

  const targetName = process.env.RESTORE_CHECK_DATABASE_URL ? 'RESTORE_CHECK_DATABASE_URL' : 'DATABASE_URL';
  const server = parsePgUrl(process.env[targetName], targetName);
  const temp = `${TEMP_PREFIX}${timestamp().toLowerCase().replace(/[^0-9a-z]/g, '')}`;
  const source = process.env.DATABASE_URL ? parsePgUrl(process.env.DATABASE_URL).database : '';
  if (!temp.startsWith(TEMP_PREFIX) || temp === source || temp === server.database) throw new Error('Refusing to use a non-temporary database name');

  // Maintenance connection: the configured database is only used to run CREATE/DROP DATABASE.
  const maintenanceDb = server.database;
  console.log(`Restoring ${path.basename(file)} into temporary database "${temp}" on ${server.host}:${server.port} …`);
  psql(server, maintenanceDb, `CREATE DATABASE "${temp}"`);
  try {
    run('pg_restore', ['--no-owner', '--no-privileges', '--exit-on-error', `--dbname=${temp}`, file], pgEnv(server, temp));
    console.log('✓ pg_restore finished without errors');

    const migrationsOnDisk = readdirSync(path.resolve('prisma/migrations'), { withFileTypes: true }).filter((d) => d.isDirectory()).length;
    const [applied, unfinished] = psql(
      server,
      temp,
      `SELECT COUNT(*), COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) FROM "_prisma_migrations"`,
    ).split('|').map(Number);
    if (unfinished > 0) throw new Error(`${unfinished} migration(s) unfinished in the backup`);
    console.log(`✓ migrations: ${applied} applied in backup, ${migrationsOnDisk} in this code${applied < migrationsOnDisk ? ' (run npm run db:deploy after restoring)' : ''}`);

    const tables = ['User', 'Client', 'Lead', 'Room', 'Service', 'Booking', 'Payment', 'ProductionTask', 'TourRequest', 'ActivityLog', 'IntegrationJob', 'Setting'];
    const counts = psql(server, temp, `SELECT ${tables.map((t) => `(SELECT COUNT(*) FROM "${t}")::text`).join(" || '|' || ")}`)
      .split('|')
      .map(Number);
    console.log('✓ tables: ' + tables.map((t, i) => `${t}=${counts[i]}`).join(', '));
    if (counts[tables.indexOf('User')] === 0) console.log('! the backup contains no staff accounts');

    const guards = psql(
      server,
      temp,
      `SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint WHERE contype = 'x'`,
    );
    if (!guards.includes('Booking_no_room_overlap')) throw new Error('Double-booking protection (exclusion constraint) is missing in the restored database');
    const triggers = psql(server, temp, `SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid = '"Payment"'::regclass`);
    if (Number(triggers) < 1) throw new Error('Payment ledger protection trigger is missing in the restored database');
    console.log(`✓ integrity guards present (exclusion constraints: ${guards}; payment ledger trigger)`);
    console.log('Restore check PASSED.');
  } finally {
    psql(server, maintenanceDb, `DROP DATABASE IF EXISTS "${temp}" WITH (FORCE)`);
    console.log(`Temporary database "${temp}" dropped.`);
  }
}

main().catch((error) => {
  console.error(`Restore check FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
