import type { PrismaClient } from '@prisma/client';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { keyedHash } from '@/lib/auth/tokens';

// Owner password recovery (used by `npm run admin:reset-password`).
// Deliberately free of `server-only` so the CLI can import it.

export class OwnerResetError extends Error {}

export interface OwnerResetResult {
  userId: string;
  sessionsRevoked: number;
}

/**
 * Resets the password of an existing OWNER. The password is never stored or
 * logged — only its Argon2id hash; ActivityLog records the fact of the reset.
 */
export async function resetOwnerPassword(
  db: PrismaClient,
  input: { email: string; password: string; confirmation: string; authSecret?: string },
): Promise<OwnerResetResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new OwnerResetError('Email is required');
  if (input.confirmation.trim().toLowerCase() !== email) {
    throw new OwnerResetError('Confirmation does not match the email — nothing changed');
  }
  const problem = validatePasswordStrength(input.password);
  if (problem) throw new OwnerResetError(`Password rejected: ${problem}`);
  if (input.password.toLowerCase().includes(email.split('@')[0])) {
    throw new OwnerResetError('Password rejected: it must not contain the email name');
  }

  const user = await db.user.findUnique({ where: { email } });
  // Same message for "no such user" and "not an owner": do not reveal which accounts exist.
  if (!user || user.role !== 'OWNER') throw new OwnerResetError('No OWNER account with this email');

  const passwordHash = await hashPassword(input.password);
  const sessionsRevoked = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    const { count } = await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.activityLog.create({
      data: {
        userId: null,
        entityType: 'User',
        entityId: user.id,
        action: 'user.password_reset.cli',
        metadata: { sessionsRevoked: count, activeAccount: user.active },
      },
    });
    return count;
  });

  // Lift a login lockout on this account so the owner can sign in right away.
  if (input.authSecret) {
    await db.rateLimit.deleteMany({ where: { key: `login:acct:${keyedHash(input.authSecret, email)}` } });
  }
  return { userId: user.id, sessionsRevoked };
}
