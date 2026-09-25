/* eslint-disable no-console */
// Validates the environment without starting the server (values are never printed).
//   npm run env:check
//   NODE_ENV=production npm run env:check     → production rules

import { validateEnv } from '../lib/env-schema';

const report = validateEnv();
const mode = process.env.NODE_ENV === 'production' && process.env.APP_ENV !== 'local' ? 'production' : 'development';
console.log(`Environment check (${mode} rules)`);
for (const e of report.errors) console.log(`  ✗ ${e}`);
for (const w of report.warnings) console.log(`  ! ${w}`);
console.log(
  `  integrations: email ${report.integrations.email ? 'on' : 'off'}, Google Calendar ${report.integrations.calendar ? 'on' : 'off'}, Google Sheets ${report.integrations.sheets ? 'on' : 'off'}`,
);
if (report.errors.length) {
  console.log(`FAILED: ${report.errors.length} problem(s).`);
  process.exitCode = 1;
} else {
  console.log('OK');
}
