/* eslint-disable no-console */
// Resets the password of an existing OWNER account.
//
// Interactive (recommended — nothing ends up in shell history):
//   npm run admin:reset-password
//
// Non-interactive (CI / scripts): pass values through the environment, never on the command line:
//   ADMIN_RESET_EMAIL      owner email
//   ADMIN_RESET_PASSWORD   new password  (e.g. `read -rs ADMIN_RESET_PASSWORD; export ADMIN_RESET_PASSWORD`)
//   ADMIN_RESET_PASSWORD_FILE  alternatively: path to a file with the password (first line)
//   ADMIN_RESET_CONFIRM    must equal the email (explicit confirmation)

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';
import { OwnerResetError, resetOwnerPassword } from '../lib/admin/owner-reset';

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Suppress echo of typed characters.
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
        if (s.includes(question)) process.stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const interactive = process.stdin.isTTY && !process.env.ADMIN_RESET_EMAIL;
  let email = process.env.ADMIN_RESET_EMAIL ?? '';
  let password = process.env.ADMIN_RESET_PASSWORD ?? '';
  let confirmation = process.env.ADMIN_RESET_CONFIRM ?? '';

  if (!password && process.env.ADMIN_RESET_PASSWORD_FILE) {
    password = readFileSync(process.env.ADMIN_RESET_PASSWORD_FILE, 'utf8').split(/\r?\n/)[0];
  }

  if (interactive) {
    email = await ask('Owner email: ');
    password = await ask('New password (hidden): ', true);
    const repeat = await ask('Repeat new password (hidden): ', true);
    if (password !== repeat) throw new OwnerResetError('Passwords do not match — nothing changed');
    console.log('\nAll sessions of this owner will be signed out.');
    confirmation = await ask(`Type the email again to confirm: `);
  } else if (!email || !password || !confirmation) {
    throw new OwnerResetError(
      'Non-interactive mode requires ADMIN_RESET_EMAIL, ADMIN_RESET_PASSWORD (or ADMIN_RESET_PASSWORD_FILE) and ADMIN_RESET_CONFIRM',
    );
  }

  const prisma = new PrismaClient();
  try {
    const result = await resetOwnerPassword(prisma, { email, password, confirmation, authSecret: process.env.AUTH_SECRET });
    console.log(`Password reset. Sessions revoked: ${result.sessionsRevoked}. The owner can sign in at /admin/login.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof OwnerResetError ? error.message : 'Reset failed (unexpected error)');
  process.exitCode = 1;
});
