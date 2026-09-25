import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import type { TestProject } from 'vitest/node';

// Creates a brand-new PostgreSQL database for this test run, applies all
// migrations to it from scratch (proving they work on a clean database), and
// drops it afterwards. Requires DATABASE_URL_TEST pointing at a database the
// role can connect to, with the CREATEDB privilege.

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const baseUrl = process.env.DATABASE_URL_TEST;
  if (!baseUrl) {
    throw new Error('DATABASE_URL_TEST is not set. Integration tests need a PostgreSQL database (see README).');
  }
  const url = new URL(baseUrl);
  const dbName = `${url.pathname.slice(1)}_run_${Date.now()}`;
  if (!/^[a-z0-9_]+$/.test(dbName)) throw new Error('Unexpected test database name');

  const admin = new PrismaClient({ datasourceUrl: baseUrl });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);

  url.pathname = `/${dbName}`;
  const runUrl = url.toString();
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: runUrl },
    stdio: 'pipe',
  });
  project.provide('databaseUrl', runUrl);

  return async () => {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.$disconnect();
  };
}
