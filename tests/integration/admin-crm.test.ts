import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as createBooking } from '@/app/api/bookings/route';
import { cancelBooking, changeBookingStatus, listBookings, bookingFiltersSchema, rescheduleBooking, updateBookingAmount, updateBookingDetails } from '@/lib/admin/bookings';
import { findDuplicateCandidates, mergeClients } from '@/lib/admin/clients';
import { RuleError } from '@/lib/admin/errors';
import { recordPayment } from '@/lib/admin/payments';
import { changeTourStatus } from '@/lib/admin/tours';
import type { SessionUser } from '@/lib/auth/service';
import { bookingBody, futureDay, postJson, useFakeIntegrationEnv } from '../support/api';
import { db, resetCatalog, truncateAll } from '../support/db';

let admin: SessionUser;

beforeAll(async () => {
  useFakeIntegrationEnv();
  await resetCatalog();
});
beforeEach(async () => {
  await truncateAll();
  const u = await db.user.create({ data: { email: 'admin@example.test', name: 'Админ', role: 'ADMIN' } });
  admin = { id: u.id, name: u.name, email: u.email, role: 'ADMIN' };
});

async function makeBooking(overrides: Record<string, unknown> = {}) {
  const res = await createBooking(postJson('/api/bookings', bookingBody(overrides)));
  expect(res.status).toBe(201);
  return db.booking.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
}

describe('reschedule', () => {
  it('19. cannot move a booking onto an occupied slot (including buffers)', async () => {
    const a = await makeBooking({ time: '12:00' });
    await makeBooking({ time: '15:00', phone: '+7 700 000 00 09' });
    await expect(rescheduleBooking(db, admin, { bookingId: a.id, date: futureDay(), time: '14:00' })).rejects.toThrow(RuleError);
    await expect(rescheduleBooking(db, admin, { bookingId: a.id, date: futureDay(), time: '15:30' })).rejects.toThrow(/занято/);
    // Unchanged after the failed attempts.
    expect((await db.booking.findUniqueOrThrow({ where: { id: a.id } })).rescheduleCount).toBe(0);
  });

  it('moves to a free slot, keeps duration, counts reschedules and logs the change', async () => {
    const a = await makeBooking({ time: '12:00', duration: 90 });
    const result = await rescheduleBooking(db, admin, { bookingId: a.id, date: futureDay(7), time: '18:00' });
    expect(result.freeByPolicy).toBe(true);
    const moved = await db.booking.findUniqueOrThrow({ where: { id: a.id } });
    expect(moved.startAt.toISOString()).toBe(new Date(`${futureDay(7)}T18:00:00+05:00`).toISOString());
    expect(moved.endAt.getTime() - moved.startAt.getTime()).toBe(90 * 60_000);
    expect(moved.rescheduleCount).toBe(1);
    const log = await db.activityLog.findFirstOrThrow({ where: { action: 'booking.reschedule' } });
    expect(log.userId).toBe(admin.id);
    // A second reschedule is no longer free by policy.
    const again = await rescheduleBooking(db, admin, { bookingId: a.id, date: futureDay(8), time: '18:00' });
    expect(again.freeByPolicy).toBe(false);
    // The old slot is free again for the public form.
    await makeBooking({ time: '12:00', phone: '+7 700 000 00 08' });
  });

  it('a concurrent public booking and a reschedule into the same slot cannot both win', async () => {
    const a = await makeBooking({ time: '12:00' });
    const [r1, r2] = await Promise.allSettled([
      rescheduleBooking(db, admin, { bookingId: a.id, date: futureDay(), time: '18:00' }),
      createBooking(postJson('/api/bookings', bookingBody({ time: '18:00', phone: '+7 700 000 00 07' }))),
    ]);
    const publicOk = r2.status === 'fulfilled' && r2.value.status === 201;
    const rescheduleOk = r1.status === 'fulfilled';
    expect(Number(publicOk) + Number(rescheduleOk)).toBe(1);
  });
});

describe('status, cancellation and amounts', () => {
  it('only allows defined status transitions and logs them', async () => {
    const a = await makeBooking();
    await changeBookingStatus(db, admin, { bookingId: a.id, status: 'CONFIRMED' });
    await expect(changeBookingStatus(db, admin, { bookingId: a.id, status: 'REQUESTED' })).rejects.toThrow(RuleError);
    await expect(changeBookingStatus(db, admin, { bookingId: a.id, status: 'CANCELLED' })).rejects.toThrow(RuleError);
    await expect(changeBookingStatus(db, admin, { bookingId: a.id, status: 'BOGUS' })).rejects.toThrow();
    const log = await db.activityLog.findFirstOrThrow({ where: { action: 'booking.status' } });
    expect(log.metadata).toEqual({ from: 'REQUESTED', to: 'CONFIRMED' });
  });

  it('cancellation frees the slot and applies the refund policy; overrides need permission and a reason', async () => {
    const a = await makeBooking();
    await recordPayment(db, admin, { bookingId: a.id, amount: 20_000, method: 'KASPI' });
    await expect(cancelBooking(db, admin, { bookingId: a.id, reason: 'клиент заболел', refundAmount: 5_000 }, { canOverrideRefund: false })).rejects.toThrow(
      /владелец или администратор/,
    );
    await expect(cancelBooking(db, admin, { bookingId: a.id, reason: 'клиент заболел', refundAmount: 5_000 }, { canOverrideRefund: true })).rejects.toThrow(
      /причину/,
    );
    // More than 48 h ahead → full refund suggested.
    const r = await cancelBooking(db, admin, { bookingId: a.id, reason: 'клиент заболел' }, { canOverrideRefund: false });
    expect(r.refund).toBe(20_000);
    const cancelled = await db.booking.findUniqueOrThrow({ where: { id: a.id } });
    expect(cancelled).toMatchObject({ status: 'CANCELLED', refundAmount: 20_000, cancellationReason: 'клиент заболел' });
    await makeBooking({ phone: '+7 700 000 00 06' }); // slot is free again
  });

  it('manual refund override is clamped to what was paid and logged with its reason', async () => {
    const a = await makeBooking();
    await recordPayment(db, admin, { bookingId: a.id, amount: 20_000, method: 'CASH' });
    const r = await cancelBooking(
      db,
      admin,
      { bookingId: a.id, reason: 'перенос невозможен', refundAmount: 99_000, overrideReason: 'жест доброй воли' },
      { canOverrideRefund: true },
    );
    expect(r.refund).toBe(20_000);
    const log = await db.activityLog.findFirstOrThrow({ where: { action: 'booking.cancel' } });
    expect(log.metadata).toMatchObject({ suggestedRefund: 20_000, refund: 20_000, overrideReason: 'жест доброй воли' });
  });

  it('changing the amount requires a reason and updates the payment status', async () => {
    const a = await makeBooking();
    await expect(updateBookingAmount(db, admin, { bookingId: a.id, totalAmount: 15_000, reason: '' })).rejects.toThrow();
    await recordPayment(db, admin, { bookingId: a.id, amount: 15_000, method: 'KASPI' });
    expect((await db.booking.findUniqueOrThrow({ where: { id: a.id } })).paymentStatus).toBe('PARTIALLY_PAID');
    await expect(updateBookingAmount(db, admin, { bookingId: a.id, totalAmount: 10_000, reason: 'ниже оплаченного' })).rejects.toThrow(/оплаченного/);
    await updateBookingAmount(db, admin, { bookingId: a.id, totalAmount: 15_000, reason: 'скидка постоянному клиенту' });
    expect(await db.booking.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ totalAmount: 15_000, paymentStatus: 'PAID' });
    expect((await db.activityLog.findFirstOrThrow({ where: { action: 'booking.amount' } })).metadata).toMatchObject({
      from: 20_000,
      to: 15_000,
      reason: 'скидка постоянному клиенту',
    });
  });

  it('assigns a responsible employee and validates links', async () => {
    const a = await makeBooking();
    await updateBookingDetails(db, admin, { bookingId: a.id, assignedToId: admin.id, internalNotes: 'Нужен третий микрофон', materialsUrl: 'https://drive.google.com/x' });
    expect(await db.booking.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ assignedToId: admin.id, materialsUrl: 'https://drive.google.com/x' });
    await expect(updateBookingDetails(db, admin, { bookingId: a.id, materialsUrl: 'javascript:alert(1)' })).rejects.toThrow();
    const log = await db.activityLog.findFirstOrThrow({ where: { action: 'booking.update' } });
    expect(JSON.stringify(log.metadata)).not.toContain('микрофон'); // note contents are not copied into the log
  });
});

describe('CRM listing', () => {
  it('finds bookings by number, phone and name, with filters and pagination', async () => {
    await makeBooking({ name: 'Айгерим', phone: '+7 700 555 44 33' });
    await makeBooking({ time: '16:00', name: 'Бекзат', phone: '+7 701 222 11 00', room: 'small' });
    const find = (q: Record<string, string>) => listBookings(db, bookingFiltersSchema.parse(q));
    expect((await find({ q: 'SS-00002' })).items.map((b) => b.client.name)).toEqual(['Бекзат']);
    expect((await find({ q: '8 700 555' })).items.map((b) => b.client.name)).toEqual(['Айгерим']);
    expect((await find({ q: 'бекз' })).total).toBe(1);
    expect((await find({ room: 'small' })).total).toBe(1);
    expect((await find({ status: 'CONFIRMED' })).total).toBe(0);
    expect((await find({ sort: 'start_asc' })).items[0].client.name).toBe('Айгерим');
    expect((await find({ page: 'abc', sort: 'nonsense' })).total).toBe(2);
  });
});

describe('clients', () => {
  it('detects and merges duplicates, moving the whole history, logged', async () => {
    await makeBooking({ name: 'Дана', phone: '+7 700 111 00 01', email: 'dana@example.test' });
    await makeBooking({ time: '16:00', name: 'дана', phone: '+7 700 111 00 02', email: '' });
    const [target, source] = await db.client.findMany({ orderBy: { createdAt: 'asc' } });
    expect((await findDuplicateCandidates(db, target)).map((c) => c.id)).toEqual([source.id]);

    const moved = await mergeClients(db, admin, { targetId: target.id, sourceId: source.id });
    expect(moved.bookings).toBe(1);
    expect(await db.client.count()).toBe(1);
    expect(await db.booking.count({ where: { clientId: target.id } })).toBe(2);
    const log = await db.activityLog.findFirstOrThrow({ where: { action: 'client.merge' } });
    expect(log.metadata).toMatchObject({ sourceId: source.id, sourcePhone: '+7 700 *** ** 02' });
    await expect(mergeClients(db, admin, { targetId: target.id, sourceId: target.id })).rejects.toThrow(RuleError);
  });
});

describe('tours in the CRM', () => {
  it('changes tour status via allowed transitions only', async () => {
    const client = await db.client.create({ data: { name: 'Гость', phone: '+7 700 000 00 99', normalizedPhone: '+77000000099' } });
    const start = new Date(`${futureDay()}T15:00:00+05:00`);
    const t = await db.tourRequest.create({ data: { clientId: client.id, scheduledAt: start, scheduledEnd: new Date(start.getTime() + 15 * 60_000) } });
    await changeTourStatus(db, admin, { tourId: t.id, status: 'CONFIRMED' });
    await changeTourStatus(db, admin, { tourId: t.id, status: 'COMPLETED' });
    await expect(changeTourStatus(db, admin, { tourId: t.id, status: 'NEW' })).rejects.toThrow(RuleError);
    expect(await db.activityLog.count({ where: { action: 'tour.status' } })).toBe(2);
  });
});
