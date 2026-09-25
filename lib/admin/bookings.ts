import 'server-only';
import type { BookingStatus, Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import { checkSlot } from '@/lib/availability';
import type { SessionUser } from '@/lib/auth/service';
import { isExclusionViolation, loadRoomBusy } from '@/lib/bookings/shared';
import { getEffectiveIntegrationConfig } from '@/lib/integrations/effective';
import {
  bookingCancelledJobs,
  bookingChangedJobs,
  bookingConfirmedJobs,
  bookingRescheduledJobs,
  enqueueJobs,
  skipObsoleteReminders,
} from '@/lib/outbox/jobs';
import { canRescheduleFree, clampRefundOverride, computeRefund } from '@/lib/policy';
import { formatBookingNumber } from '@/lib/public/schemas';
import { getCancellationPolicy, getReminderRules, getWorkingHours } from '@/lib/settings';
import { studioDayRange, utcToZoned } from '@/lib/time';
import { RuleError } from './errors';
import { advanceLinkedLead } from './leads';
import { recomputeBookingPayment } from './payments';
import { createTasksForBooking, shiftOpenTaskDeadlines } from './production';
import { BOOKING_STATUS_LABELS, BOOKING_TRANSITIONS } from './labels';

// ─── Listing ──────────────────────────────────────────────────────────────────

export const BOOKING_SORTS = {
  created_desc: { createdAt: 'desc' },
  start_asc: { startAt: 'asc' },
  start_desc: { startAt: 'desc' },
  amount_desc: { totalAmount: 'desc' },
} as const satisfies Record<string, Prisma.BookingOrderByWithRelationInput>;

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const bookingFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(['REQUESTED', 'CONTACTED', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional().catch(undefined),
  room: z.string().max(32).optional().catch(undefined),
  service: z.string().max(32).optional().catch(undefined),
  payment: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED']).optional().catch(undefined),
  from: optionalDate,
  to: optionalDate,
  sort: z.enum(Object.keys(BOOKING_SORTS) as [keyof typeof BOOKING_SORTS]).catch('created_desc'),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type BookingFilters = z.infer<typeof bookingFiltersSchema>;

export const BOOKINGS_PAGE_SIZE = 25;

export function bookingSearchWhere(filters: BookingFilters): Prisma.BookingWhereInput {
  const and: Prisma.BookingWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    const number = /^(?:ss-?)?0*(\d{1,9})$/i.exec(q);
    const digits = q.replace(/\D/g, '');
    const or: Prisma.BookingWhereInput[] = [{ client: { name: { contains: q, mode: 'insensitive' } } }];
    if (number) or.push({ bookingNumber: Number(number[1]) });
    if (digits.length >= 4) or.push({ client: { normalizedPhone: { contains: digits.replace(/^8/, '7') } } });
    and.push({ OR: or });
  }
  if (filters.status) and.push({ status: filters.status });
  if (filters.room) and.push({ room: { slug: filters.room } });
  if (filters.service) and.push({ service: { slug: filters.service } });
  if (filters.payment) and.push({ paymentStatus: filters.payment });
  if (filters.from) and.push({ startAt: { gte: studioDayRange(filters.from).start } });
  if (filters.to) and.push({ startAt: { lt: studioDayRange(filters.to).end } });
  return and.length ? { AND: and } : {};
}

export async function listBookings(db: PrismaClient, filters: BookingFilters) {
  const where = bookingSearchWhere(filters);
  const [items, total] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: [BOOKING_SORTS[filters.sort], { id: 'asc' }],
      skip: (filters.page - 1) * BOOKINGS_PAGE_SIZE,
      take: BOOKINGS_PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true, normalizedPhone: true } },
        room: { select: { nameRu: true, color: true } },
        service: { select: { nameRu: true } },
      },
    }),
    db.booking.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / BOOKINGS_PAGE_SIZE)) };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

async function loadForUpdate(tx: Prisma.TransactionClient, bookingId: string) {
  // Row lock: status changes, reschedules and payments of one booking are serialised.
  await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { room: true, client: { select: { email: true } } } });
  if (!booking) throw new RuleError('Заказ не найден');
  return booking;
}

async function lifecycleCtx(tx: Prisma.TransactionClient, clientEmail: string | null) {
  return { config: await getEffectiveIntegrationConfig(tx), hasClientEmail: Boolean(clientEmail) };
}

async function syncCalendar(tx: Prisma.TransactionClient, bookingId: string) {
  return enqueueJobs(tx, bookingChangedJobs(bookingId, String(Date.now()), await getEffectiveIntegrationConfig(tx)));
}

export async function changeBookingStatus(db: PrismaClient, actor: SessionUser, input: { bookingId: string; status: string }) {
  const status = z.enum(Object.keys(BOOKING_TRANSITIONS) as [BookingStatus]).parse(input.status);
  return db.$transaction(async (tx) => {
    const booking = await loadForUpdate(tx, input.bookingId);
    if (booking.status === status) return { jobIds: [] as string[] };
    if (!BOOKING_TRANSITIONS[booking.status].includes(status)) {
      throw new RuleError(
        `Нельзя перевести заказ из статуса «${BOOKING_STATUS_LABELS[booking.status]}» в «${BOOKING_STATUS_LABELS[status]}»`,
      );
    }
    await tx.booking.update({ where: { id: booking.id }, data: { status } });
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'booking.status',
      metadata: { from: booking.status, to: status },
    });
    if (status === 'CONFIRMED') {
      // Everything that follows a confirmation happens in this same transaction:
      // production tasks, lead → WON, "confirmed" email, reminders, calendar.
      await createTasksForBooking(tx, booking.id, actor.id);
      await advanceLinkedLead(tx, { bookingId: booking.id }, 'WON', actor.id, 'booking confirmed');
      const ctx = await lifecycleCtx(tx, booking.client.email);
      const jobIds = await enqueueJobs(tx, bookingConfirmedJobs(booking.id, booking.startAt, new Date(), ctx, await getReminderRules(tx)));
      return { jobIds };
    }
    return { jobIds: await syncCalendar(tx, booking.id) };
  });
}

const rescheduleSchema = z.object({
  bookingId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Укажите дату'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Выберите время'),
});

const SLOT_MESSAGES: Record<string, string> = {
  INVALID_DATE: 'Некорректная дата',
  PAST: 'Это время уже прошло',
  CLOSED: 'В этот день студия не работает',
  OUTSIDE_HOURS: 'Время выходит за рабочие часы',
  OFF_GRID: 'Выберите время из сетки слотов',
  CONFLICT: 'Это время занято другим заказом (с учётом буферов комнаты)',
};

/** Moves a booking to another time in the same room. Never overlaps another booking (DB-enforced). */
export async function rescheduleBooking(db: PrismaClient, actor: SessionUser, input: z.input<typeof rescheduleSchema>, now = new Date()) {
  const data = rescheduleSchema.parse(input);
  const booking = await db.booking.findUnique({ where: { id: data.bookingId }, include: { room: true } });
  if (!booking) throw new RuleError('Заказ не найден');
  if (!['REQUESTED', 'CONTACTED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) {
    throw new RuleError('Перенести можно только активный заказ');
  }
  const durationMinutes = Math.round((booking.endAt.getTime() - booking.startAt.getTime()) / 60_000);
  const hours = await getWorkingHours(db);
  const slot = checkSlot({
    date: data.date,
    time: data.time,
    durationMinutes,
    bufferBeforeMinutes: booking.room.bufferBeforeMinutes,
    bufferAfterMinutes: booking.room.bufferAfterMinutes,
    stepMinutes: hours.slotStepMinutes,
    busy: await loadRoomBusy(db, booking.roomId, data.date, booking.id),
    hours,
    now,
    ignoreLeadAndHorizon: true,
  });
  if (!slot.ok) throw new RuleError(SLOT_MESSAGES[slot.reason] ?? 'Это время недоступно');

  const policy = await getCancellationPolicy(db);
  const free = canRescheduleFree(policy, { rescheduleCount: booking.rescheduleCount, startAt: booking.startAt, now });
  try {
    return await db.$transaction(async (tx) => {
      const locked = await loadForUpdate(tx, booking.id);
      if (locked.startAt.getTime() !== booking.startAt.getTime() || locked.status !== booking.status) {
        throw new RuleError('Заказ только что изменили — обновите страницу');
      }
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          startAt: slot.startAt,
          endAt: slot.endAt,
          blockedFrom: slot.blockedFrom,
          blockedUntil: slot.blockedUntil,
          rescheduleCount: { increment: 1 },
        },
      });
      const from = utcToZoned(booking.startAt);
      await logActivity(tx, {
        userId: actor.id,
        entityType: 'Booking',
        entityId: booking.id,
        action: 'booking.reschedule',
        metadata: {
          from: `${from.date} ${from.time}`,
          to: `${data.date} ${data.time}`,
          freeByPolicy: free.allowed,
          ...(free.allowed ? {} : { policyNote: free.reason ?? null }),
        },
      });
      await shiftOpenTaskDeadlines(tx, booking.id, slot.startAt.getTime() - booking.startAt.getTime());
      await skipObsoleteReminders(tx, 'Booking', booking.id, 'rescheduled', slot.startAt);
      const ctx = await lifecycleCtx(tx, locked.client.email);
      const jobIds = await enqueueJobs(
        tx,
        bookingRescheduledJobs(booking.id, slot.startAt, booking.status === 'CONFIRMED', now, ctx, await getReminderRules(tx)),
      );
      return { freeByPolicy: free.allowed, jobIds };
    });
  } catch (error) {
    if (isExclusionViolation(error, 'Booking_no_room_overlap')) throw new RuleError(SLOT_MESSAGES.CONFLICT);
    throw error;
  }
}

const cancelSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().trim().min(3, 'Укажите причину отмены').max(500),
  refundAmount: z.number().int().min(0).max(10_000_000).optional(),
  overrideReason: z.string().trim().max(500).optional(),
});

/**
 * Cancels a booking. The refund defaults to the policy suggestion; a different
 * amount requires the refunds:manage permission and a written reason.
 */
export async function cancelBooking(
  db: PrismaClient,
  actor: SessionUser,
  input: z.input<typeof cancelSchema>,
  opts: { canOverrideRefund: boolean; now?: Date },
) {
  const data = cancelSchema.parse(input);
  return db.$transaction(async (tx) => {
    const booking = await loadForUpdate(tx, data.bookingId);
    if (booking.status === 'CANCELLED') throw new RuleError('Заказ уже отменён');
    if (booking.status === 'COMPLETED') throw new RuleError('Завершённый заказ нельзя отменить');

    const policy = await getCancellationPolicy(tx);
    const quote = computeRefund(policy, { paidAmount: booking.paidAmount, startAt: booking.startAt, now: opts.now });
    let refund = quote.amount;
    const overridden = data.refundAmount !== undefined && data.refundAmount !== quote.amount;
    if (overridden) {
      if (!opts.canOverrideRefund) throw new RuleError('Изменить сумму возврата может только владелец или администратор');
      if (!data.overrideReason || data.overrideReason.length < 5) {
        throw new RuleError('Укажите причину, по которой сумма возврата отличается от правил');
      }
      refund = clampRefundOverride(data.refundAmount!, booking.paidAmount);
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: data.reason,
        refundAmount: booking.paidAmount > 0 ? refund : null,
      },
    });
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'booking.cancel',
      metadata: {
        from: booking.status,
        reason: data.reason,
        paid: booking.paidAmount,
        policyTier: quote.tier,
        suggestedRefund: quote.amount,
        refund: booking.paidAmount > 0 ? refund : 0,
        ...(overridden ? { overrideReason: data.overrideReason ?? null } : {}),
      },
    });
    await skipObsoleteReminders(tx, 'Booking', booking.id, 'cancelled');
    const ctx = await lifecycleCtx(tx, booking.client.email);
    return { refund, jobIds: await enqueueJobs(tx, bookingCancelledJobs(booking.id, ctx)) };
  });
}

const amountSchema = z.object({
  bookingId: z.string().min(1),
  totalAmount: z.number().int('Сумма должна быть целым числом').min(0).max(10_000_000),
  reason: z.string().trim().min(5, 'Укажите причину изменения суммы (не короче 5 символов)').max(500),
});

export async function updateBookingAmount(db: PrismaClient, actor: SessionUser, input: z.input<typeof amountSchema>) {
  const data = amountSchema.parse(input);
  return db.$transaction(async (tx) => {
    const booking = await loadForUpdate(tx, data.bookingId);
    if (booking.totalAmount === data.totalAmount) return;
    if (data.totalAmount < booking.paidAmount) {
      throw new RuleError(`Стоимость не может быть меньше уже оплаченного (${booking.paidAmount} ₸). Сначала оформите возврат.`);
    }
    await tx.booking.update({ where: { id: booking.id }, data: { totalAmount: data.totalAmount } });
    await recomputeBookingPayment(tx, booking.id);
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'booking.amount',
      metadata: { from: booking.totalAmount, to: data.totalAmount, reason: data.reason },
    });
  });
}

const detailsSchema = z.object({
  bookingId: z.string().min(1),
  internalNotes: z.string().max(5000).optional(),
  materialsUrl: z
    .union([z.literal(''), z.url({ protocol: /^https?$/, message: 'Ссылка должна начинаться с http:// или https://' }).max(1000)])
    .optional(),
  assignedToId: z.string().max(40).optional(),
});

export async function updateBookingDetails(db: PrismaClient, actor: SessionUser, input: z.input<typeof detailsSchema>) {
  const data = detailsSchema.parse(input);
  return db.$transaction(async (tx) => {
    const booking = await loadForUpdate(tx, data.bookingId);
    const assignedToId = data.assignedToId ? data.assignedToId : null;
    if (assignedToId) {
      const user = await tx.user.findUnique({ where: { id: assignedToId } });
      if (!user?.active) throw new RuleError('Ответственный сотрудник не найден или отключён');
    }
    const next = {
      internalNotes: data.internalNotes?.trim() || null,
      materialsUrl: data.materialsUrl?.trim() || null,
      assignedToId,
    };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => booking[k] !== next[k]);
    if (changed.length === 0) return;
    await tx.booking.update({ where: { id: booking.id }, data: next });
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'Booking',
      entityId: booking.id,
      // Field names only: note contents stay in the booking itself.
      action: 'booking.update',
      metadata: { fields: changed, ...(changed.includes('assignedToId') ? { assignedToId } : {}) },
    });
  });
}

export function bookingLabel(b: { bookingNumber: number }) {
  return formatBookingNumber(b.bookingNumber);
}
