import { defineConfig, devices } from '@playwright/test';

// End-to-end run against a production build in dry-run mode (no real emails,
// Calendar or Sheets). The global setup creates a temporary database, builds
// and starts the app on port 3100; the teardown stops it and drops the database.
export default defineConfig({
  testDir: 'e2e',
  testIgnore: ['**/.auth/**'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3100',
    locale: 'ru-RU',
    timezoneId: 'Asia/Almaty',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
