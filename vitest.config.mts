import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

const alias = {
  '@': root,
  // `server-only` throws outside the React Server environment; tests run in plain Node.
  'server-only': path.join(root, 'tests/support/server-only.ts'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['tests/support/global-db-setup.ts'],
          setupFiles: ['tests/support/db-env.ts'],
          // Tests share one database; run files one after another.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
