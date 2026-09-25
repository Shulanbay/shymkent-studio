import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { changeBookingStatus } from '@/lib/admin/bookings';
import { deleteCatalogEntity, saveRoom, saveService, setArchived } from '@/lib/admin/catalog';
import { RuleError } from '@/lib/admin/errors';
import { availableMinutes, percentChange, previousPeriod, resolvePeriod, revenue, roomUtilization } from '@/lib/admin/metrics';
import { recordPayment, refundPayment, reversePayment } from '@/lib/admin/payments';
import type { SessionUser } from '@/lib/auth/service';
import { DEFAULT_WORKING_HOURS } from '@/lib/settings-schema';
import { futureDay, get, useFakeIntegrationEnv } from '../support/api';
import { db, resetCatalog, truncateAll } from '../support/db';
import { makeStaff, publicBooking } from '../support/fixtures';
import { GET as availability } from '@/app/api/availability/route';

let admin: SessionUser;
beforeAll(async () => {
  useFakeIntegrationEnv();
  await resetCatalog();
});
beforeEach(async () => {
  await truncateAll();
  await resetCatalog();
  admin = await makeStaff('ADMIN');
});

describe('14. revenue', () => {
  it('counts settled payments only, subtracts refunds and reversals, ignores pending/failed', async () => {
    const a = await publicBooking({ service: 'pro', duration: 90 });
    const b = await publicBooking({ service: 'pro', duration: 90, time: '16:00', phone: '+7 700 111 11 11' });
    await recordPayment(db, admin, { bookingId: a.id, amount: 40_000, method: 'KASPI' });
    const { payment } = await recordPayment(db, admin, { bookingId: b.id, amount: 30_000, method: 'CASH' });
    await recordPayment(db, admin, { bookingId: b.id, amount: 10_000, method: 'KASPI', status: 'PENDING' });
    await refundPayment(db, admin, { bookingId: a.id, amount: 8_000, method: 'KASPI', note: 'частичный возврат' });
    await reversePayment(db, admin, { paymentId: payment.id, reason: 'ошибочная запись' });
    const period = resolvePeriod({ period: 'today' });
    expect(await revenue(db, period.from, period.to)).toEqual({ net: 32_000, incoming: 70_000, outgoing: 38_000 });
    const past = resolvePeriod({ period: 'custom', from: '2020-01-01', to: '2020-01-31' });
    expect((await revenue(db, past.from, past.to)).net).toBe(0);
  });

  it('compares periods without dividing by zero', () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(-10, 20)).toBe(-150);
  });

  it('builds Asia/Almaty periods', () => {
    const now = new Date('2026-03-01T20:30:00Z'); // 2 March 01:30 in Almaty
    const month = resolvePeriod({ period: 'month' }, now);
    expect([month.firstDay, month.lastDay]).toEqual(['2026-03-01', '2026-03-31']);
    expect(month.from.toISOString()).toBe('2026-02-28T19:00:00.000Z');
    expect(previousPeriod(month).firstDay).toBe('2026-02-01');
    expect(previousPeriod(month).lastDay).toBe('2026-02-28');
    expect(resolvePeriod({ period: 'today' }, now).firstDay).toBe('2026-03-02');
  });
});

describe('15. room utilisation', () => {
  it('divides booked minutes (cancelled excluded) by open minutes', async () => {
    const day = futureDay(12);
    const a = await publicBooking({ date: day, time: '10:00', service: 'pro', duration: 90 });
    await publicBooking({ date: day, time: '14:00', duration: 60, phone: '+7 700 222 22 22' });
    const c = await publicBooking({ date: day, time: '18:00', duration: 60, phone: '+7 700 333 33 33' });
    await db.booking.update({ where: { id: c.id }, data: { status: 'CANCELLED' } });
    await changeBookingStatus(db, admin, { bookingId: a.id, status: 'CONFIRMED' });
    const period = resolvePeriod({ period: 'custom', from: day, to: day });
    const rows = await roomUtilization(db, period, DEFAULT_WORKING_HOURS);
    const large = rows.find((r) => r.nameRu === 'Большая студия')!;
    expect(large.openMinutes).toBe(12 * 60);
    expect(large.bookedMinutes).toBe(150);
    expect(large.percent).toBe(20.8);
    expect(rows.find((r) => r.nameRu === 'Living Room')!.percent).toBe(0);
    expect(availableMinutes({ ...DEFAULT_WORKING_HOURS, exceptions: { [day]: null } }, day, day)).toBe(0);
  });
});

describe('22/23. catalog rules', () => {
  it('22. archiving hides a room from the booking form; restoring brings it back', async () => {
    const room = await db.room.findUniqueOrThrow({ where: { slug: 'lounge' } });
    await setArchived(db, admin, 'room', room.id, true);
    const res = await availability(get(`/api/availability?room=lounge&service=starter&date=${futureDay()}&duration=60`));
    expect(res.status).toBe(422);
    await setArchived(db, admin, 'room', room.id, false);
    expect((await availability(get(`/api/availability?room=lounge&service=starter&date=${futureDay()}&duration=60`))).status).toBe(200);
    expect(await db.activityLog.count({ where: { action: 'catalog.room' } })).toBe(2);
  });

  it('23. a room or tariff in use cannot be deleted and its slug is frozen; unused ones can be deleted', async () => {
    const b = await publicBooking();
    await expect(deleteCatalogEntity(db, admin, 'room', b.roomId)).rejects.toThrow(/архивировать/);
    await expect(deleteCatalogEntity(db, admin, 'service', b.serviceId)).rejects.toThrow(RuleError);
    const used = await db.room.findUniqueOrThrow({ where: { id: b.roomId } });
    await expect(saveRoom(db, admin, { ...used, slug: 'renamed', googleColorId: used.googleColorId ?? '' })).rejects.toThrow(/Slug/);
    const created = await saveRoom(db, admin, { slug: 'test-extra', nameRu: 'Доп. комната', nameKk: 'Қосымша', capacity: 2, color: '#123456', googleColorId: '', bufferBeforeMinutes: 0, bufferAfterMinutes: 0, sortOrder: 9 });
    await deleteCatalogEntity(db, admin, 'room', created.id);
    expect(await db.room.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it('validates tariff prices and durations', async () => {
    const base = { slug: 'test-svc', nameRu: 'Тест', nameKk: 'Тест', descriptionRu: '', descriptionKk: '', sortOrder: 9 };
    await expect(saveService(db, admin, { ...base, basePrice: -1, defaultDuration: 60, maxDuration: 60 })).rejects.toThrow();
    await expect(saveService(db, admin, { ...base, basePrice: 100, defaultDuration: 60, maxDuration: 90 })).rejects.toThrow();
    await expect(saveService(db, admin, { ...base, basePrice: 100, defaultDuration: 60, maxDuration: 100, extraStepMinutes: 30, extraStepPrice: 10 })).rejects.toThrow();
    const ok = await saveService(db, admin, { ...base, basePrice: 100, defaultDuration: 60, maxDuration: 120, extraStepMinutes: 30, extraStepPrice: 10 });
    expect(ok.maxDuration).toBe(120);
  });

  it('refuses to archive the last active tariff', async () => {
    const services = await db.service.findMany({ where: { active: true } });
    for (const s of services.slice(1)) await setArchived(db, admin, 'service', s.id, true);
    await expect(setArchived(db, admin, 'service', services[0].id, true)).rejects.toThrow(/последнюю/);
  });
});
