import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GET as cronGet } from '@/app/api/cron/outbox/route';
import { cancelBooking, changeBookingStatus, rescheduleBooking } from '@/lib/admin/bookings';
import { changeTourStatus, rescheduleTour } from '@/lib/admin/tours';
import type { SessionUser } from '@/lib/auth/service';
import { calendarEventId } from '@/lib/outbox/handlers';
import { claimJobs, cleanupCompletedJobs, processOutbox } from '@/lib/outbox/process';
import { RecordingTransports, getRecordingTransports, getTransports } from '@/lib/outbox/transports';
import { NextRequest } from 'next/server';
import { futureDay, useFakeIntegrationEnv } from '../support/api';
import { db, resetCatalog, truncateAll } from '../support/db';
import { makeStaff, publicBooking, publicTour } from '../support/fixtures';

let admin: SessionUser;
beforeAll(async () => {
  useFakeIntegrationEnv();
  await resetCatalog();
});
beforeEach(async () => {
  await truncateAll();
  getRecordingTransports().reset();
  admin = await makeStaff('ADMIN');
});

const jobTypes = async (entityId: string) => (await db.integrationJob.findMany({ where: { entityId }, orderBy: { createdAt: 'asc' } })).map((j) => j.type);
/** Makes scheduled (future) jobs due so reminders can be exercised. */
const makeAllDue = () => db.integrationJob.updateMany({ where: { status: 'PENDING' }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });

describe('booking lifecycle communications', () => {
  it('16. confirming creates the confirmation email, reminders and a calendar update in the same transaction', async () => {
    const b = await publicBooking({ date: futureDay(10) });
    await changeBookingStatus(db, admin, { bookingId: b.id, status: 'CONFIRMED' });
    const types = await jobTypes(b.id);
    expect(types).toEqual(expect.arrayContaining(['booking.confirmed_email', 'booking.reminder_24h', 'booking.reminder_2h']));
    const reminder = await db.integrationJob.findFirstOrThrow({ where: { entityId: b.id, type: 'booking.reminder_24h' } });
    expect(reminder.nextAttemptAt.getTime()).toBe(b.startAt.getTime() - 24 * 3600_000);

    const t = new RecordingTransports();
    await processOutbox(db, { transports: t, limit: 100 });
    // Reminders are not due yet.
    expect(t.emails.map((e) => e.subject).some((s) => s.startsWith('Напоминание'))).toBe(false);
    expect(t.emails.some((e) => e.subject.includes('подтверждено'))).toBe(true);
  });

  it('17. repeating the same action does not create another email', async () => {
    const b = await publicBooking();
    await changeBookingStatus(db, admin, { bookingId: b.id, status: 'CONFIRMED' });
    await changeBookingStatus(db, admin, { bookingId: b.id, status: 'CONFIRMED' }); // no-op
    await changeBookingStatus(db, admin, { bookingId: b.id, status: 'PENDING_PAYMENT' });
    await changeBookingStatus(db, admin, { bookingId: b.id, status: 'CONFIRMED' });
    expect(await db.integrationJob.count({ where: { entityId: b.id, type: 'booking.confirmed_email' } })).toBe(1);
    await cancelBooking(db, admin, { bookingId: b.id, reason: 'клиент отменил' }, { canOverrideRefund: false });
    await expect(cancelBooking(db, admin, { bookingId: b.id, reason: 'ещё раз' }, { canOverrideRefund: false })).rejects.toThrow();
    expect(await db.integrationJob.count({ where: { entityId: b.id, type: 'booking.cancelled_email' } })).toBe(1);
  });

  it('18. a reschedule updates the calendar event, emails the new time, and old reminders stay silent', async () => {
    const b = await publicBooking({ date: futureDay(10), time: '12:00' });
    await changeBookingStatus(db, admin, { bookingId: b.id, status: 'CONFIRMED' });
    const t = new RecordingTransports();
    await processOutbox(db, { transports: t, limit: 100 });
    const eventId = calendarEventId('b', b.id);
    expect(t.calendar.get(eventId)?.start.toISOString()).toBe(b.startAt.toISOString());

    await rescheduleBooking(db, admin, { bookingId: b.id, date: futureDay(11), time: '16:00' });
    await processOutbox(db, { transports: t, limit: 100 });
    const moved = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(t.calendar.get(eventId)?.start.toISOString()).toBe(moved.startAt.toISOString());
    expect(t.calendar.size).toBe(1); // updated, not duplicated
    expect(t.emails.filter((e) => e.subject.includes('перенесено'))).toHaveLength(1);

    // Fire every reminder now: only the ones for the new time send; the old ones are skipped.
    await makeAllDue();
    const sentBefore = t.emails.length;
    await processOutbox(db, { transports: t, limit: 100 });
    const reminders = t.emails.slice(sentBefore).filter((e) => /Напоминание|Через 2 часа/.test(e.subject));
    expect(reminders).toHaveLength(2);
    expect(reminders.every((e) => e.subject.includes('16:00'))).toBe(true);
  });

  it('19. cancelling removes the calendar event and emails the client', async () => {
    const b = await publicBooking({ date: futureDay(10) });
    await changeBookingStatus(db, admin, { bookingId: b.id, status: 'CONFIRMED' });
    const t = new RecordingTransports();
    await processOutbox(db, { transports: t, limit: 100 });
    expect(t.calendar.has(calendarEventId('b', b.id))).toBe(true);
    await cancelBooking(db, admin, { bookingId: b.id, reason: 'клиент заболел' }, { canOverrideRefund: false });
    await makeAllDue();
    await processOutbox(db, { transports: t, limit: 100 });
    expect(t.calendar.has(calendarEventId('b', b.id))).toBe(false);
    expect(t.calendarDeletes).toContain(calendarEventId('b', b.id));
    expect(t.emails.some((e) => e.subject.includes('отменено'))).toBe(true);
    // No reminder is ever sent for a cancelled booking.
    expect(t.emails.some((e) => /Напоминание|Через 2 часа/.test(e.subject))).toBe(false);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).googleCalendarEventId).toBeNull();
  });

  it('sends client emails in the client language and records provider message ids', async () => {
    const b = await publicBooking({ locale: 'kk' });
    await changeBookingStatus(db, admin, { bookingId: b.id, status: 'CONFIRMED' });
    const t = new RecordingTransports();
    await processOutbox(db, { transports: t, limit: 100 });
    expect(t.emails.find((e) => e.to === 'client@example.test' && e.subject.includes('расталды'))).toBeTruthy();
    const job = await db.integrationJob.findFirstOrThrow({ where: { entityId: b.id, type: 'booking.confirmed_email' } });
    expect(job.providerRef).toMatch(/dry-run/);
  });

  it('keeps Google Sheets in sync by booking number (upsert, no duplicates)', async () => {
    const b = await publicBooking();
    await changeBookingStatus(db, admin, { bookingId: b.id, status: 'CONFIRMED' });
    const t = new RecordingTransports();
    await processOutbox(db, { transports: t, limit: 100 });
    expect(t.sheets.size).toBe(1);
    expect(t.sheets.get('SS-00001')?.status).toBe('CONFIRMED');
  });
});

describe('tour lifecycle', () => {
  it('confirm, reschedule and cancel produce the matching emails and calendar changes', async () => {
    const tour = await publicTour({ date: futureDay(9) });
    await db.client.update({ where: { id: tour.clientId }, data: { email: 'guest@example.test' } });
    const t = new RecordingTransports();
    await changeTourStatus(db, admin, { tourId: tour.id, status: 'CONFIRMED' });
    await rescheduleTour(db, admin, { tourId: tour.id, date: futureDay(9), time: '17:00' });
    await processOutbox(db, { transports: t, limit: 100 });
    expect(t.emails.filter((e) => e.to === 'guest@example.test').map((e) => e.subject)).toEqual(
      expect.arrayContaining([expect.stringContaining('расталды'), expect.stringContaining('ауыстырылды')]),
    );
    await changeTourStatus(db, admin, { tourId: tour.id, status: 'CANCELLED' });
    await processOutbox(db, { transports: t, limit: 100 });
    expect(t.calendar.has(calendarEventId('t', tour.id))).toBe(false);
    expect(t.emails.some((e) => e.subject.includes('тоқтатылды'))).toBe(true);
  });

  it('tours do not block rooms (separate resource) but never overlap each other', async () => {
    await publicTour({ date: futureDay(9), time: '12:00' });
    await publicBooking({ date: futureDay(9), time: '12:00' });
    const second = await publicTour({ date: futureDay(9), time: '14:00', phone: '+7 709 000 00 01' });
    await expect(rescheduleTour(db, admin, { tourId: second.id, date: futureDay(9), time: '12:00' })).rejects.toThrow(/другой тур/);
  });
});

describe('outbox robustness', () => {
  it('21. jobs stuck in PROCESSING after a worker crash are picked up again', async () => {
    const b = await publicBooking();
    await db.integrationJob.updateMany({ where: { entityId: b.id }, data: { status: 'PROCESSING', lockedAt: new Date(Date.now() - 20 * 60_000), attempts: 1 } });
    const t = new RecordingTransports();
    const result = await processOutbox(db, { transports: t, limit: 100 });
    expect(result.completed).toBe(await db.integrationJob.count({ where: { entityId: b.id } }));
    // A recently locked job (another worker is on it) is not stolen.
    const fresh = await publicBooking({ time: '16:00', phone: '+7 704 000 00 04' });
    await db.integrationJob.updateMany({ where: { entityId: fresh.id }, data: { status: 'PROCESSING', lockedAt: new Date() } });
    expect(await claimJobs(db, { limit: 100 })).toHaveLength(0);
  });

  it('an email already accepted by the provider is not sent again after a crash', async () => {
    const b = await publicBooking();
    await db.integrationJob.updateMany({
      where: { entityId: b.id, type: 'booking.admin_email' },
      data: { status: 'PROCESSING', lockedAt: new Date(Date.now() - 20 * 60_000), providerRef: '<sent-before-crash@x>' },
    });
    const t = new RecordingTransports();
    await processOutbox(db, { transports: t, limit: 100 });
    expect(t.emails.filter((e) => e.to === 'admin@example.test')).toHaveLength(0);
    expect((await db.integrationJob.findFirstOrThrow({ where: { entityId: b.id, type: 'booking.admin_email' } })).status).toBe('COMPLETED');
  });

  it('20. the cron endpoint requires the secret, caps the batch and cleans old jobs', async () => {
    process.env.CRON_SECRET = 'cron-secret-for-integration-tests-0123456789';
    const call = (auth?: string, qs = '') =>
      cronGet(new NextRequest(`http://localhost:3000/api/cron/outbox${qs}`, { headers: auth ? { authorization: auth } : {} }));
    expect((await call()).status).toBe(404);
    expect((await call('Bearer wrong-secret-wrong-secret')).status).toBe(404);
    const b = await publicBooking();
    await db.integrationJob.create({
      data: { type: 'booking.admin_email', entityType: 'Booking', entityId: b.id, idempotencyKey: 'old-done', status: 'COMPLETED', completedAt: new Date(Date.now() - 90 * 86_400_000) },
    });
    const ok = await call(`Bearer ${process.env.CRON_SECRET}`, '?limit=100000');
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.claimed).toBeLessThanOrEqual(100);
    expect(body.cleaned).toBe(1);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(await cleanupCompletedJobs(db, 30)).toBe(0);
  });

  it('27. tests never reach real email or Google services', () => {
    expect(getTransports().kind).toBe('recording');
  });
});
