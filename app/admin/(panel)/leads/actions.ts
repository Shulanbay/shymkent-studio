'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { actionError, type ActionState } from '@/lib/admin/action-state';
import { createLead, moveLead, updateLead } from '@/lib/admin/leads';
import { assertPermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

const str = (f: FormData, k: string) => String(f.get(k) ?? '');

/** Called by the kanban (drag-and-drop / move menu) and by the lead card. Validated on the server. */
export async function moveLeadAction(input: { leadId: string; status: string; lostReason?: string }): Promise<ActionState> {
  try {
    const actor = await assertPermission('leads:manage');
    await moveLead(prisma, actor, input as never);
    revalidatePath('/admin/leads');
    revalidatePath(`/admin/leads/${input.leadId}`);
    return { ok: true, message: 'Статус изменён' };
  } catch (error) {
    return actionError(error);
  }
}

export async function moveLeadFormAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return moveLeadAction({ leadId: str(formData, 'leadId'), status: str(formData, 'status'), lostReason: str(formData, 'lostReason') || undefined });
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    const actor = await assertPermission('leads:manage');
    const lead = await createLead(prisma, actor, {
      name: str(formData, 'name'),
      phone: str(formData, 'phone'),
      email: str(formData, 'email'),
      source: str(formData, 'source') as never,
      title: str(formData, 'title'),
      expectedAmount: str(formData, 'expectedAmount'),
      nextContactAt: str(formData, 'nextContactAt'),
      assignedToId: str(formData, 'assignedToId'),
      notes: str(formData, 'notes'),
    });
    id = lead.id;
    revalidatePath('/admin/leads');
  } catch (error) {
    return actionError(error);
  }
  redirect(`/admin/leads/${id}`);
}

export async function updateLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('leads:manage');
    const leadId = str(formData, 'leadId');
    await updateLead(prisma, actor, {
      leadId,
      title: str(formData, 'title'),
      source: str(formData, 'source') as never,
      expectedAmount: str(formData, 'expectedAmount'),
      nextContactAt: str(formData, 'nextContactAt'),
      assignedToId: str(formData, 'assignedToId'),
      notes: str(formData, 'notes'),
    });
    revalidatePath(`/admin/leads/${leadId}`);
    revalidatePath('/admin/leads');
    return { ok: true, message: 'Сохранено' };
  } catch (error) {
    return actionError(error);
  }
}
