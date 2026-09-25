'use server';

import { revalidatePath } from 'next/cache';
import { actionError, type ActionState } from '@/lib/admin/action-state';
import { recordPayment, refundPayment, reversePayment, setPaymentLink, settlePendingPayment } from '@/lib/admin/payments';
import { assertPermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { scheduleOutboxProcessing } from '@/lib/outbox/schedule';

const str = (f: FormData, k: string) => String(f.get(k) ?? '');
const num = (f: FormData, k: string) => {
  const raw = str(f, k).replace(/\s/g, '');
  return raw === '' ? Number.NaN : Number(raw);
};

function refresh(bookingId: string) {
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/payments');
  revalidatePath('/admin');
}

export async function recordPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('payments:manage');
    const bookingId = str(formData, 'bookingId');
    const result = await recordPayment(prisma, actor, {
      bookingId,
      amount: num(formData, 'amount'),
      method: str(formData, 'method') as never,
      status: (str(formData, 'status') || 'PAID') as never,
      reference: str(formData, 'reference'),
      note: str(formData, 'note'),
      proofUrl: str(formData, 'proofUrl'),
      paidAt: str(formData, 'paidAt') || undefined,
    });
    scheduleOutboxProcessing(result.jobIds);
    refresh(bookingId);
    return { ok: true, message: result.payment.status === 'PAID' ? 'Оплата проведена' : 'Ожидающий платёж создан' };
  } catch (error) {
    return actionError(error);
  }
}

export async function settlePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('payments:manage');
    const outcome = str(formData, 'outcome') === 'FAILED' ? 'FAILED' : 'PAID';
    const result = await settlePendingPayment(prisma, actor, { paymentId: str(formData, 'paymentId'), outcome, reference: str(formData, 'reference') });
    scheduleOutboxProcessing(result.jobIds);
    refresh(result.booking.id);
    return { ok: true, message: outcome === 'PAID' ? 'Оплата подтверждена' : 'Платёж отмечен как не прошедший' };
  } catch (error) {
    return actionError(error);
  }
}

export async function refundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('refunds:manage');
    const bookingId = str(formData, 'bookingId');
    const result = await refundPayment(prisma, actor, {
      bookingId,
      amount: num(formData, 'amount'),
      method: str(formData, 'method') as never,
      reference: str(formData, 'reference'),
      note: str(formData, 'note'),
    });
    scheduleOutboxProcessing(result.jobIds);
    refresh(bookingId);
    return { ok: true, message: 'Возврат проведён' };
  } catch (error) {
    return actionError(error);
  }
}

export async function reverseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('refunds:manage');
    const result = await reversePayment(prisma, actor, { paymentId: str(formData, 'paymentId'), reason: str(formData, 'reason') });
    scheduleOutboxProcessing(result.jobIds);
    refresh(result.booking.id);
    return { ok: true, message: 'Операция сторнирована' };
  } catch (error) {
    return actionError(error);
  }
}

export async function paymentLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await assertPermission('payments:manage');
    const bookingId = str(formData, 'bookingId');
    const result = await setPaymentLink(prisma, actor, { bookingId, url: str(formData, 'url'), notify: formData.get('notify') === 'on' });
    scheduleOutboxProcessing(result.jobIds);
    refresh(bookingId);
    return {
      ok: true,
      message: result.emailQueued ? 'Ссылка сохранена, письмо клиенту поставлено в очередь' : 'Ссылка сохранена (письмо не отправлялось)',
    };
  } catch (error) {
    return actionError(error);
  }
}
