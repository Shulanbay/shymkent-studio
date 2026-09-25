import { hash, verify } from '@node-rs/argon2';

// Argon2id with OWASP-recommended parameters (19 MiB, 2 iterations, 1 lane).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Пароль должен быть не длиннее ${PASSWORD_MAX_LENGTH} символов`;
  if (new Set(password).size < 5) return 'Пароль слишком простой';
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

// Hash of a random string, used to spend the same time verifying when the
// account does not exist (prevents user enumeration by timing).
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= hash('dummy-password-for-timing-equalisation', OPTIONS);
  return dummyHash;
}

export async function verifyPassword(passwordHash: string | null | undefined, password: string): Promise<boolean> {
  if (password.length > PASSWORD_MAX_LENGTH) return false;
  try {
    if (!passwordHash) {
      await verify(await getDummyHash(), password);
      return false;
    }
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
