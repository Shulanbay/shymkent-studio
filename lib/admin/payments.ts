import 'server-only';
import type { BookingPaymentStatus, PaymentMethod, Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import type { SessionUser } from '@/lib/auth/service';
import { getEffectiveIntegrationConfig } from '@/lib/integrations/effective';
import { bookingChangedJobs, enqueueJobs, paymentLinkJobs } from '@/lib/outbox/jobs';
import { formatBookingNumber } from '@/lib/public/schemas';
import { studioDayRange } from '@/lib/time';
import { RuleError } from './errors';
import { optionalStudioDateTime } from './zod-helpers';

// Payments ledger. Money is whole tenge (Int); nothing is ever computed in floats.
// Booking.paidAmount / paymentStatus are derived here from settled (PAID) rows only.

type Tx = Prisma.TransactionClient;

export const PAYMENT_METHODS = ['KASPI', 'BANK_TRANSFER', 'CASH', 'OTHER'] as const;
const MAX_AMOUNT = 10_000_000;

const amountSchema = z
  .number({ message: 'Укажите сумму' })
  .int('Сумма — целое число тенге')
  .positive('Сумма должна быть больше нуля')
  .max(MAX_AMOUNT, 'Слишком большая сумма');
const optionalUrl = z
  .union([z.literal(''), z.url({ protocol: /^https?$/, message: 'Ссылка должна начинаться с http:// или https://' }).max(1000)])
  .optional()
  .transform((v) => v || null);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

/** Pure: payment status from what the booking costs and what is actually (net) paid. */
export function derivePaymentStatus(total: number, netPaid: number, hasSettledRefund: boolean): BookingPaymentStatus {
  if (netPaid <= 0) return hasSettledRefund ? 'REFUNDED' : 'UNPAID';
  if (netPaid >= total) return 'PAID';
  return 'PARTIALLY_PAID';
}

/** Locks the booking row so concurrent ledger writes for one booking are serialised. */
async function lockBooking(tx: Tx, bookingId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
  if (rows.length === 0) throw new RuleError('Заказ не найден');
  return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
}

async function netPaid(tx: Tx, bookingId: string): Promise<number> {
  const agg = await tx.payment.aggregate({ where: { bookingId, status: 'PAID' }, _sum: { signedAmount: true } });
  return agg._sum.signedAmount ?? 0;
}

/** Recomputes paidAmount / paymentStatus from the ledger. Call inside the same transaction. */
export async function recomputeBookingPayment(tx: Tx, bookingId: string) {
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { totalAmount: true } });
  const paid = await netPaid(tx, bookingId);
  const refunds = await tx.payment.count({ where: { bookingId, status: 'PAID', kind: 'REFUND' } });
  const status = derivePaymentStatus(booking.totalAmount, paid, refunds > 0);
  return tx.booking.update({ where: { id: bookingId }, data: { paidAmount: paid, paymentStatus: status } });
}

async function syncIntegrations(tx: Tx, bookingId: string) {
  return enqueueJobs(tx, bookingChangedJobs(bookingId, `payment:${Date.now()}`, await getEffectiveIntegrationConfig(tx)));
}

// ─── Record a payment (MANAGER+) ─────────────────────────────────────────────

const recordSchema = z.object({
  bookingId: z.string().min(1),
  amount: amountSchema,
  method: z.enum(PAYMENT_METHODS),
  /** PENDING = awaiting money (e.g. Kaspi invoice sent); PAID = money received. */
  status: z.enum(['PAID', 'PENDING']).default('PAID'),
  reference: optionalText(200),
  note: optionalText(1000),
  proofUrl: optionalUrl,
  paidAt: optionalStudioDateTime,
});

export async function recordPayment(db: PrismaClient, actor: SessionUser, input: z.input<typeof recordSchema>) {
  const data = recordSchema.parse(input);
  if (data.paidAt && data.paidAt.getTime() > Date.now() + 60_000) throw new RuleError('Дата оплаты не может быть в будущем');
  return db.$transaction(async (tx) => {
    const booking = await lockBooking(tx, data.bookingId);
    if (booking.status === 'CANCELLED') throw new RuleError('Нельзя принять оплату по отменённому заказу');
    if (data.status === 'PAID') {
      const paid = await netPaid(tx, booking.id);
      if (paid + data.amount > booking.totalAmount) {
        throw new RuleError(
          `Оплата превышает стоимость заказа (осталось ${booking.totalAmount - paid} ₸). Сначала измените стоимость заказа с указанием причины.`,
        );
      }
    }
    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        kind: 'PAYMENT',
        amount: data.amount,
        signedAmount: data.amount,
        method: data.method,
        status: data.status,
        reference: data.reference,
        note: data.note,
        proofUrl: data.proofUrl,
        paidAt: data.status === 'PAID' ? (data.paidAt ?? new Date()) : null,
        recordedById: actor.id,
      },
    });
    const updated = await recomputeBookingPayment(tx, booking.id);
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'payment.record',
      metadata: { paymentId: payment.id, amount: data.amount, method: data.method, status: data.status, paymentStatus: updated.paymentStatus },
    });
    const jobIds = await syncIntegrations(tx, booking.id);
    return { payment, booking: updated, jobIds };
  });
}

/** A PENDING payment becomes PAID once the money arrives (or FAILED if it never does). */
export async function settlePendingPayment(
  db: PrismaClient,
  actor: SessionUser,
  input: { paymentId: string; outcome: 'PAID' | 'FAILED'; reference?: string; paidAt?: Date },
) {
  return db.$transaction(async (tx) => {
    const found = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!found) throw new RuleError('Платёж не найден');
    const booking = await lockBooking(tx, found.bookingId);
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
    if (payment.status !== 'PENDING') throw new RuleError('Изменить можно только ожидающий платёж');
    if (input.outcome === 'PAID') {
      const paid = await netPaid(tx, booking.id);
      if (paid + payment.amount > booking.totalAmount) throw new RuleError('Оплата превышает стоимость заказа');
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: input.outcome,
        paidAt: input.outcome === 'PAID' ? (input.paidAt ?? new Date()) : null,
        reference: input.reference?.trim() || payment.reference,
      },
    });
    const updated = await recomputeBookingPayment(tx, booking.id);
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'Booking',
      entityId: booking.id,
      action: input.outcome === 'PAID' ? 'payment.confirm' : 'payment.fail',
      metadata: { paymentId: payment.id, amount: payment.amount },
    });
    return { booking: updated, jobIds: await syncIntegrations(tx, booking.id) };
  });
}

// ─── Refunds and reversals (OWNER / ADMIN) ───────────────────────────────────

const refundSchema = z.object({
  bookingId: z.string().min(1),
  amount: amountSchema,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(200),
  note: z.string().trim().min(3, 'Укажите причину возврата').max(1000),
});

/** A refund is a separate ledger entry; it can never exceed what was actually paid. */
export async function refundPayment(db: PrismaClient, actor: SessionUser, input: z.input<typeof refundSchema>) {
  const data = refundSchema.parse(input);
  return db.$transaction(async (tx) => {
    const booking = await lockBooking(tx, data.bookingId);
    const paid = await netPaid(tx, booking.id);
    if (data.amount > paid) throw new RuleError(`Нельзя вернуть больше оплаченного (оплачено ${paid} ₸)`);
    const refund = await tx.payment.create({
      data: {
        bookingId: booking.id,
        kind: 'REFUND',
        amount: data.amount,
        signedAmount: -data.amount,
        method: data.method,
        status: 'PAID',
        reference: data.reference,
        note: data.note,
        paidAt: new Date(),
        recordedById: actor.id,
      },
    });
    const updated = await recomputeBookingPayment(tx, booking.id);
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'payment.refund',
      metadata: { paymentId: refund.id, amount: data.amount, method: data.method, reason: data.note },
    });
    return { refund, booking: updated, jobIds: await syncIntegrations(tx, booking.id) };
  });
}

/**
 * Cancels a mistaken settled entry with a compensating REVERSAL (the original
 * row stays untouched). Each entry can be reversed once.
 */
export async function reversePayment(db: PrismaClient, actor: SessionUser, input: { paymentId: string; reason: string }) {
  const reason = z.string().trim().min(5, 'Укажите причину сторнирования (не короче 5 символов)').max(1000).parse(input.reason);
  return db.$transaction(async (tx) => {
    const found = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!found) throw new RuleError('Платёж не найден');
    const booking = await lockBooking(tx, found.bookingId);
    const original = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId }, include: { reversedBy: true } });
    if (original.kind === 'REVERSAL') throw new RuleError('Сторнирующую операцию нельзя сторнировать');
    if (original.status !== 'PAID') throw new RuleError('Сторнировать можно только проведённую операцию');
    if (original.reversedBy) throw new RuleError('Эта операция уже сторнирована');
    const paid = await netPaid(tx, booking.id);
    if (paid - original.signedAmount < 0) {
      throw new RuleError('После сторно сумма оплаты стала бы отрицательной — сначала сторнируйте возврат');
    }
    const reversal = await tx.payment.create({
      data: {
        bookingId: booking.id,
        kind: 'REVERSAL',
        amount: original.amount,
        signedAmount: -original.signedAmount,
        method: original.method,
        status: 'PAID',
        reversesId: original.id,
        note: reason,
        paidAt: new Date(),
        recordedById: actor.id,
      },
    });
    const updated = await recomputeBookingPayment(tx, booking.id);
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'payment.reverse',
      metadata: { paymentId: reversal.id, reverses: original.id, amount: original.amount, originalKind: original.kind, reason },
    });
    return { reversal, booking: updated, jobIds: await syncIntegrations(tx, booking.id) };
  });
}

// ─── Payment link ─────────────────────────────────────────────────────────────

export async function setPaymentLink(db: PrismaClient, actor: SessionUser, input: { bookingId: string; url: string; notify: boolean }) {
  const url = z
    .url({ protocol: /^https$/, message: 'Ссылка на оплату должна начинаться с https://' })
    .max(1000)
    .parse(input.url.trim());
  return db.$transaction(async (tx) => {
    const booking = await lockBooking(tx, input.bookingId);
    if (booking.status === 'CANCELLED') throw new RuleError('Заказ отменён');
    const client = await tx.client.findUniqueOrThrow({ where: { id: booking.clientId } });
    await tx.booking.update({ where: { id: booking.id }, data: { paymentLinkUrl: url } });
    const config = await getEffectiveIntegrationConfig(tx);
    const jobIds = input.notify ? await enqueueJobs(tx, paymentLinkJobs(booking.id, url, { config, hasClientEmail: Boolean(client.email) })) : [];
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'Booking',
      entityId: booking.id,
      action: 'payment.link',
      metadata: { notified: input.notify && jobIds.length > 0, emailAvailable: Boolean(client.email) },
    });
    return { jobIds, emailQueued: jobIds.length > 0 };
  });
}

// ─── Listing ──────────────────────────────────────────────────────────────────

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const paymentFiltersSchema = z.object({
  view: z.enum(['payments', 'debts']).catch('payments'),
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(['PENDING', 'PAID', 'FAILED']).optional().catch(undefined),
  kind: z.enum(['PAYMENT', 'REFUND', 'REVERSAL']).optional().catch(undefined),
  method: z.enum(PAYMENT_METHODS).optional().catch(undefined),
  from: optionalDate,
  to: optionalDate,
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;
export const PAYMENTS_PAGE_SIZE = 30;

function bookingQuery(q: string | undefined): Prisma.BookingWhereInput | undefined {
  if (!q) return undefined;
  const number = /^(?:ss-?)?0*(\d{1,9})$/i.exec(q);
  const digits = q.replace(/\D/g, '');
  return {
    OR: [
      { client: { name: { contains: q, mode: 'insensitive' } } },
      ...(number ? [{ bookingNumber: Number(number[1]) }] : []),
      ...(digits.length >= 4 ? [{ client: { normalizedPhone: { contains: digits.replace(/^8/, '7') } } }] : []),
    ],
  };
}

export async function listPayments(db: PrismaClient, f: PaymentFilters) {
  const where: Prisma.PaymentWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.method ? { method: f.method as PaymentMethod } : {}),
    ...(f.from || f.to
      ? { createdAt: { ...(f.from ? { gte: studioDayRange(f.from).start } : {}), ...(f.to ? { lt: studioDayRange(f.to).end } : {}) } }
      : {}),
    ...(f.q ? { booking: bookingQuery(f.q) } : {}),
  };
  const [items, total, sums] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (f.page - 1) * PAYMENTS_PAGE_SIZE,
      take: PAYMENTS_PAGE_SIZE,
      include: {
        booking: { select: { id: true, bookingNumber: true, client: { select: { name: true } } } },
        recordedBy: { select: { name: true } },
      },
    }),
    db.payment.count({ where }),
    db.payment.aggregate({ where: { ...where, status: 'PAID' }, _sum: { signedAmount: true } }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE)), netSettled: sums._sum.signedAmount ?? 0 };
}

/** Active bookings that are not fully paid, with the outstanding balance computed in SQL. */
export async function listDebts(db: PrismaClient, f: PaymentFilters) {
  const where: Prisma.BookingWhereInput = {
    status: { in: ['REQUESTED', 'CONTACTED', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED'] },
    paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
    ...(bookingQuery(f.q) ?? {}),
  };
  const [items, total, outstanding] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      skip: (f.page - 1) * PAYMENTS_PAGE_SIZE,
      take: PAYMENTS_PAGE_SIZE,
      include: { client: { select: { name: true, normalizedPhone: true } }, service: { select: { nameRu: true } } },
    }),
    db.booking.count({ where }),
    db.$queryRaw<{ sum: bigint | null }[]>`
      SELECT SUM("totalAmount" - "paidAmount") AS sum FROM "Booking"
      WHERE "status" IN ('REQUESTED','CONTACTED','PENDING_PAYMENT','CONFIRMED','COMPLETED')
        AND "paymentStatus" IN ('UNPAID','PARTIALLY_PAID')`,
  ]);
  return {
    items,
    total,
    pages: Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE)),
    outstanding: Number(outstanding[0]?.sum ?? 0),
  };
}

export const paymentLabel = (b: { bookingNumber: number }) => formatBookingNumber(b.bookingNumber);
