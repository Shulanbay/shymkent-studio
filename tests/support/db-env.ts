import { inject } from 'vitest';

// Point every PrismaClient created in integration tests at the per-run database.
process.env.DATABASE_URL = inject('databaseUrl');
process.env.AUTH_SECRET ??= 'integration-test-secret-integration-test-secret';
