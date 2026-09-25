'use server';

import { revalidatePath } from 'next/cache';
import { actionError, type ActionState } from '@/lib/admin/action-state';
import { changeTourStatus, rescheduleTour, updateTourNotes } from '@/lib/admin/tours';
import { assertPermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { scheduleOutboxProcessing } from '@/lib/outbox/schedule';

export async function tourStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('tours:manage');
    const tourId = String(formData.get('tourId') ?? '');
    const { jobIds } = await changeTourStatus(prisma, actor, { tourId, status: String(formData.get('status') ?? '') });
    scheduleOutboxProcessing(jobIds);
    revalidatePath('/admin/tours');
    revalidatePath(`/admin/tours/${tourId}`);
    return { ok: true, message: 'Статус изменён' };
  } catch (error) {
    return actionError(error);
  }
}

export async function tourNotesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('tours:manage');
    const tourId = String(formData.get('tourId') ?? '');
    await updateTourNotes(prisma, actor, { tourId, notes: String(formData.get('notes') ?? '') });
    revalidatePath(`/admin/tours/${tourId}`);
    return { ok: true, message: 'Заметки сохранены' };
  } catch (error) {
    return actionError(error);
  }
}

export async function rescheduleTourAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('tours:manage');
    const tourId = String(formData.get('tourId') ?? '');
    const { jobIds } = await rescheduleTour(prisma, actor, {
      tourId,
      date: String(formData.get('date') ?? ''),
      time: String(formData.get('time') ?? ''),
    });
    scheduleOutboxProcessing(jobIds);
    revalidatePath('/admin/tours');
    revalidatePath(`/admin/tours/${tourId}`);
    return { ok: true, message: 'Тур перенесён' };
  } catch (error) {
    return actionError(error);
  }
}
