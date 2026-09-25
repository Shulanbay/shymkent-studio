/* eslint-disable no-console */
// Creates a compressed PostgreSQL backup (pg_dump custom format).
//
//   npm run db:backup                       → backups/<db>-<UTC time>.dump (+ .sha256)
//   BACKUP_DIR=/secure/place npm run db:backup
//   BACKUP_DATABASE_URL=… npm run db:backup  (back up another database than DATABASE_URL)
//
// Never overwrites an existing file. The dump contains personal data: keep it
// outside the repository (backups/ is git-ignored) and in encrypted storage.

import { createHash } from 'node:crypto';
import { chmodSync, closeSync, createReadStream, existsSync, mkdirSync, openSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parsePgUrl, pgEnv, run, timestamp } from './lib/pg';

function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

async function main() {
  const source = process.env.BACKUP_DATABASE_URL ? 'BACKUP_DATABASE_URL' : 'DATABASE_URL';
  const conn = parsePgUrl(process.env[source], source);
  const dir = path.resolve(process.env.BACKUP_DIR || 'backups');
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const file = path.join(dir, `${conn.database}-${timestamp()}.dump`);
  // Claim the name atomically: fails if a backup with this name already exists.
  let fd: number;
  try {
    fd = openSync(file, 'wx', 0o600);
  } catch {
    throw new Error(`Backup file already exists, refusing to overwrite: ${file}`);
  }
  closeSync(fd);

  console.log(`Backing up database "${conn.database}" on ${conn.host}:${conn.port} …`);
  try {
    run('pg_dump', ['--format=custom', '--compress=6', '--no-owner', '--no-privileges', `--file=${file}`], pgEnv(conn));
  } catch (error) {
    if (existsSync(file) && statSync(file).size === 0) unlinkSync(file);
    throw error;
  }
  chmodSync(file, 0o600);
  const digest = await sha256(file);
  writeFileSync(`${file}.sha256`, `${digest}  ${path.basename(file)}\n`, { flag: 'wx', mode: 0o600 });
  const size = statSync(file).size;
  console.log(`Backup written: ${file} (${(size / 1024 / 1024).toFixed(2)} MB), sha256 ${digest.slice(0, 16)}…`);
  const shown = file.startsWith(process.cwd()) ? path.relative(process.cwd(), file) : file;
  console.log(`Verify it with: npm run db:restore-check -- ${shown}`);
}

main().catch((error) => {
  console.error(`Backup failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
