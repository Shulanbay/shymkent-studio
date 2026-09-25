'use server';

import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import { actionError, type ActionState } from '@/lib/admin/action-state';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth/password';
import { AuthorizationError, getCurrentUser, readSessionToken } from '@/lib/auth/session';
import { hashSessionToken } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Введите текущий пароль').max(256),
    newPassword: z.string().superRefine((value, ctx) => {
      const problem = validatePasswordStrength(value);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Пароли не совпадают', path: ['confirmPassword'] });

export async function changeOwnPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    // Any signed-in staff member may change their own password.
    const user = await getCurrentUser();
    if (!user) throw new AuthorizationError(401);
    const data = schema.parse({
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      confirmPassword: formData.get('confirmPassword'),
    });
    const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!(await verifyPassword(record?.passwordHash, data.currentPassword))) {
      return { error: 'Текущий пароль указан неверно' };
    }
    const passwordHash = await hashPassword(data.newPassword);
    const currentToken = await readSessionToken();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      // Sign out every other device, keep the current session.
      await tx.session.deleteMany({
        where: { userId: user.id, ...(currentToken ? { tokenHash: { not: hashSessionToken(currentToken) } } : {}) },
      });
      await logActivity(tx, { userId: user.id, entityType: 'User', entityId: user.id, action: 'user.password_change' });
    });
    return { ok: true, message: 'Пароль изменён. Другие устройства отключены.' };
  } catch (error) {
    return actionError(error);
  }
}
