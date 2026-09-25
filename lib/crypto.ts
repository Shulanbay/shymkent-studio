import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

// Symmetric encryption for secrets stored in the database (e.g. the Google
// refresh token). Key is derived from AUTH_SECRET; rotating AUTH_SECRET makes
// previously stored secrets unreadable, and the integration must be reconnected.

const VERSION = 'v1';

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'shymkent-studio', 'settings-encryption-v1', 32));
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join(':');
}

export function decryptSecret(payload: string, secret: string): string {
  const [version, iv, tag, data] = payload.split(':');
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Unsupported secret format');
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
