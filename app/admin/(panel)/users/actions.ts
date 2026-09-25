'use server';

import { revalidatePath } from 'next/cache';
import { actionError, type ActionState } from '@/lib/admin/action-state';
import { UserRuleError, createStaffUser, resetStaffPassword, updateStaffUser } from '@/lib/admin/users';
import { assertPermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

function handle(error: unknown): ActionState {
  if (error instanceof UserRuleError) return { error: error.message };
  return actionError(error);
}

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('users:manage');
    await createStaffUser(prisma, actor, {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      role: formData.get('role'),
      password: String(formData.get('password') ?? ''),
    });
    revalidatePath('/admin/users');
    return { ok: true, message: 'Сотрудник добавлен. Передайте ему пароль лично.' };
  } catch (error) {
    return handle(error);
  }
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('users:manage');
    await updateStaffUser(prisma, actor, {
      userId: String(formData.get('userId') ?? ''),
      role: formData.get('role'),
      active: formData.get('active') === 'on',
    });
    revalidatePath('/admin/users');
    return { ok: true, message: 'Сохранено' };
  } catch (error) {
    return handle(error);
  }
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('users:manage');
    await resetStaffPassword(prisma, actor, {
      userId: String(formData.get('userId') ?? ''),
      password: String(formData.get('password') ?? ''),
    });
    return { ok: true, message: 'Пароль изменён, все сессии сотрудника завершены' };
  } catch (error) {
    return handle(error);
  }
}
