'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { actionError, type ActionState } from '@/lib/admin/action-state';
import { mergeClients, updateClient } from '@/lib/admin/clients';
import { assertPermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

const str = (formData: FormData, key: string) => String(formData.get(key) ?? '');

export async function updateClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('clients:manage');
    const clientId = str(formData, 'clientId');
    await updateClient(prisma, actor, {
      clientId,
      name: str(formData, 'name'),
      email: str(formData, 'email'),
      company: str(formData, 'company'),
      notes: str(formData, 'notes'),
    });
    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath('/admin/clients');
    return { ok: true, message: 'Сохранено' };
  } catch (error) {
    return actionError(error);
  }
}

export async function mergeClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const targetId = str(formData, 'targetId');
  try {
    const actor = await assertPermission('clients:merge');
    if (formData.get('confirm') !== 'on') return { error: 'Подтвердите объединение' };
    await mergeClients(prisma, actor, { targetId, sourceId: str(formData, 'sourceId') });
    revalidatePath('/admin/clients');
  } catch (error) {
    return actionError(error);
  }
  redirect(`/admin/clients/${targetId}?merged=1`);
}
