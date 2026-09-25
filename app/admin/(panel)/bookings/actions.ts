'use server';

import { revalidatePath } from 'next/cache';
import { actionError, type ActionState } from '@/lib/admin/action-state';
import { cancelBooking, changeBookingStatus, rescheduleBooking, updateBookingAmount, updateBookingDetails } from '@/lib/admin/bookings';
import { hasPermission } from '@/lib/auth/permissions';
import { assertPermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { scheduleOutboxProcessing } from '@/lib/outbox/schedule';
import { logActivity } from '@/lib/activity';
import { ensureLeadForBooking } from '@/lib/admin/leads';

const str = (formData: FormData, key: string) => String(formData.get(key) ?? '');

function refresh(bookingId: string) {
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/calendar');
}

export async function changeStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('bookings:manage');
    const bookingId = str(formData, 'bookingId');
    const { jobIds } = await changeBookingStatus(prisma, actor, { bookingId, status: str(formData, 'status') });
    scheduleOutboxProcessing(jobIds);
    refresh(bookingId);
    return { ok: true, message: 'Статус изменён' };
  } catch (error) {
    return actionError(error);
  }
}

export async function rescheduleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('bookings:manage');
    const bookingId = str(formData, 'bookingId');
    const result = await rescheduleBooking(prisma, actor, { bookingId, date: str(formData, 'date'), time: str(formData, 'time') });
    scheduleOutboxProcessing(result.jobIds);
    refresh(bookingId);
    return {
      ok: true,
      message: result.freeByPolicy
        ? 'Заказ перенесён (бесплатный перенос по правилам)'
        : 'Заказ перенесён. По правилам этот перенос не бесплатный — при необходимости измените сумму.',
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('bookings:manage');
    const bookingId = str(formData, 'bookingId');
    const refundRaw = str(formData, 'refundAmount').trim();
    const result = await cancelBooking(
      prisma,
      actor,
      {
        bookingId,
        reason: str(formData, 'reason'),
        refundAmount: refundRaw === '' ? undefined : Number(refundRaw),
        overrideReason: str(formData, 'overrideReason') || undefined,
      },
      { canOverrideRefund: hasPermission(actor.role, 'refunds:manage') },
    );
    scheduleOutboxProcessing(result.jobIds);
    refresh(bookingId);
    return { ok: true, message: 'Заказ отменён, время освобождено' };
  } catch (error) {
    return actionError(error);
  }
}

export async function amountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('payments:manage');
    const bookingId = str(formData, 'bookingId');
    await updateBookingAmount(prisma, actor, {
      bookingId,
      totalAmount: Number(str(formData, 'totalAmount')),
      reason: str(formData, 'reason'),
    });
    refresh(bookingId);
    return { ok: true, message: 'Сумма изменена' };
  } catch (error) {
    return actionError(error);
  }
}

export async function detailsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('bookings:manage');
    const bookingId = str(formData, 'bookingId');
    await updateBookingDetails(prisma, actor, {
      bookingId,
      internalNotes: str(formData, 'internalNotes'),
      materialsUrl: str(formData, 'materialsUrl'),
      assignedToId: str(formData, 'assignedToId'),
    });
    refresh(bookingId);
    return { ok: true, message: 'Сохранено' };
  } catch (error) {
    return actionError(error);
  }
}

export async function createLeadFromBookingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('leads:manage');
    const bookingId = str(formData, 'bookingId');
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const lead = await ensureLeadForBooking(tx, booking);
      await logActivity(tx, { userId: actor.id, entityType: 'Lead', entityId: lead.id, action: 'lead.create', metadata: { fromBooking: bookingId } });
    });
    refresh(bookingId);
    return { ok: true, message: 'Лид создан' };
  } catch (error) {
    return actionError(error);
  }
}
