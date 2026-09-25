import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RuleError } from '@/lib/admin/errors';
import { recordPayment, refundPayment, reversePayment, setPaymentLink, settlePendingPayment } from '@/lib/admin/payments';
import { hasPermission } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/service';
import { useFakeIntegrationEnv } from '../support/api';
import { db, resetCatalog, truncateAll } from '../support/db';
import { makeStaff, publicBooking } from '../support/fixtures';

let admin: SessionUser;
let manager: SessionUser;
beforeAll(async () => {
  useFakeIntegrationEnv();
  await resetCatalog();
});
beforeEach(async () => {
  await truncateAll();
  admin = await makeStaff('ADMIN');
  manager = await makeStaff('MANAGER');
});

const reload = (id: string) => db.booking.findUniqueOrThrow({ where: { id } });

describe('payments ledger', () => {
  it('6/7. partial then full payment; paid amount and balance come from the ledger', async () => {
    const b = await publicBooking({ service: 'pro', duration: 90 }); // 40 000 ₸
    await recordPayment(db, manager, { bookingId: b.id, amount: 15_000, method: 'KASPI', reference: 'K-1' });
    let booking = await reload(b.id);
    expect(booking).toMatchObject({ paidAmount: 15_000, paymentStatus: 'PARTIALLY_PAID' });
    expect(booking.totalAmount - booking.paidAmount).toBe(25_000);
    await recordPayment(db, manager, { bookingId: b.id, amount: 25_000, method: 'CASH' });
    booking = await reload(b.id);
    expect(booking).toMatchObject({ paidAmount: 40_000, paymentStatus: 'PAID' });
    await expect(recordPayment(db, manager, { bookingId: b.id, amount: 1, method: 'CASH' })).rejects.toThrow(/превышает/);
    expect(await db.activityLog.count({ where: { entityId: b.id, action: 'payment.record' } })).toBe(2);
  });

  it('rejects zero, negative and fractional amounts', async () => {
    const b = await publicBooking();
    for (const amount of [0, -100, 10.5]) await expect(recordPayment(db, manager, { bookingId: b.id, amount, method: 'KASPI' })).rejects.toThrow();
    expect(await db.payment.count()).toBe(0);
  });

  it('pending payments do not count until confirmed', async () => {
    const b = await publicBooking();
    const { payment } = await recordPayment(db, manager, { bookingId: b.id, amount: 20_000, method: 'KASPI', status: 'PENDING' });
    expect((await reload(b.id)).paymentStatus).toBe('UNPAID');
    await settlePendingPayment(db, manager, { paymentId: payment.id, outcome: 'PAID' });
    expect((await reload(b.id)).paymentStatus).toBe('PAID');
    await expect(settlePendingPayment(db, manager, { paymentId: payment.id, outcome: 'FAILED' })).rejects.toThrow(RuleError);
  });

  it('8. refunds are separate entries and never exceed what was paid', async () => {
    const b = await publicBooking();
    await recordPayment(db, manager, { bookingId: b.id, amount: 20_000, method: 'KASPI' });
    await expect(refundPayment(db, admin, { bookingId: b.id, amount: 20_001, method: 'KASPI', note: 'отмена' })).rejects.toThrow(/больше оплаченного/);
    await refundPayment(db, admin, { bookingId: b.id, amount: 16_000, method: 'KASPI', note: 'отмена за 30 ч' });
    expect(await reload(b.id)).toMatchObject({ paidAmount: 4_000, paymentStatus: 'PARTIALLY_PAID' });
    await refundPayment(db, admin, { bookingId: b.id, amount: 4_000, method: 'KASPI', note: 'остаток' });
    expect(await reload(b.id)).toMatchObject({ paidAmount: 0, paymentStatus: 'REFUNDED' });
    expect(await db.payment.count({ where: { bookingId: b.id } })).toBe(3);
  });

  it('9. a mistaken payment is cancelled by a compensating reversal; history is immutable', async () => {
    const b = await publicBooking();
    const { payment } = await recordPayment(db, manager, { bookingId: b.id, amount: 20_000, method: 'KASPI' });
    const { reversal } = await reversePayment(db, admin, { paymentId: payment.id, reason: 'ошибка кассира' });
    expect(reversal).toMatchObject({ kind: 'REVERSAL', amount: 20_000, signedAmount: -20_000, reversesId: payment.id });
    expect(await reload(b.id)).toMatchObject({ paidAmount: 0, paymentStatus: 'UNPAID' });
    // The original row is untouched and still PAID.
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: 'PAID', amount: 20_000 });
    await expect(reversePayment(db, admin, { paymentId: payment.id, reason: 'ещё раз' })).rejects.toThrow(/уже сторнирована/);
    await expect(reversePayment(db, admin, { paymentId: reversal.id, reason: 'сторно сторно' })).rejects.toThrow(RuleError);
    // The database itself refuses edits and deletes of settled rows.
    await expect(db.payment.delete({ where: { id: payment.id } })).rejects.toThrow(/cannot be deleted/);
    await expect(db.payment.update({ where: { id: payment.id }, data: { amount: 1, signedAmount: 1 } })).rejects.toThrow(/immutable/);
  });

  it('refuses a reversal that would make the balance negative', async () => {
    const b = await publicBooking();
    const { payment } = await recordPayment(db, manager, { bookingId: b.id, amount: 20_000, method: 'KASPI' });
    await refundPayment(db, admin, { bookingId: b.id, amount: 5_000, method: 'KASPI', note: 'частичный возврат' });
    await expect(reversePayment(db, admin, { paymentId: payment.id, reason: 'ошибочный платёж' })).rejects.toThrow(/отрицательной/);
  });

  it('concurrent payments on one booking cannot overpay (row lock)', async () => {
    const b = await publicBooking(); // 20 000 ₸
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => recordPayment(db, manager, { bookingId: b.id, amount: 10_000, method: 'KASPI' })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect((await reload(b.id)).paidAmount).toBe(20_000);
  });

  it('stores the Kaspi link and queues the payment-link email once per link', async () => {
    const b = await publicBooking();
    const first = await setPaymentLink(db, manager, { bookingId: b.id, url: 'https://kaspi.kz/pay/abc', notify: true });
    const again = await setPaymentLink(db, manager, { bookingId: b.id, url: 'https://kaspi.kz/pay/abc', notify: true });
    expect(first.emailQueued).toBe(true);
    expect(again.emailQueued).toBe(false);
    expect((await reload(b.id)).paymentLinkUrl).toBe('https://kaspi.kz/pay/abc');
    await expect(setPaymentLink(db, manager, { bookingId: b.id, url: 'http://insecure.example', notify: false })).rejects.toThrow();
  });

  it('10. permissions: MANAGER records, only OWNER/ADMIN refund or reverse, OPERATOR/EDITOR read-only', () => {
    expect(hasPermission('MANAGER', 'payments:manage')).toBe(true);
    expect(hasPermission('MANAGER', 'refunds:manage')).toBe(false);
    for (const role of ['OWNER', 'ADMIN'] as const) expect(hasPermission(role, 'refunds:manage')).toBe(true);
    for (const role of ['OPERATOR', 'EDITOR'] as const) {
      expect(hasPermission(role, 'payments:view')).toBe(true);
      expect(hasPermission(role, 'payments:manage')).toBe(false);
      expect(hasPermission(role, 'refunds:manage')).toBe(false);
    }
  });
});
