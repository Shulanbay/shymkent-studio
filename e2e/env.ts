import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const E2E_PORT = 3100;
export const STATE_FILE = path.resolve('e2e/.auth/state.json');

export interface E2EState {
  databaseUrl: string;
  databaseName: string;
  ownerEmail: string;
  ownerPassword: string;
  cronSecret: string;
  serverPid?: number;
}

export function readState(): E2EState {
  if (!existsSync(STATE_FILE)) throw new Error('E2E state missing — run through `npm run test:e2e`');
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2EState;
}
