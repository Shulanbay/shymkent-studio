import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as createBooking } from '@/app/api/bookings/route';
import { POST as createTour } from '@/app/api/tours/route';
import { calendarEventId } from '@/lib/outbox/handlers';
import { processOutbox, requeueJob } from '@/lib/outbox/process';
import { RecordingTransports, getRecordingTransports, getTransports } from '@/lib/outbox/transports';
import { bookingBody, postJson, tourBody, useFakeIntegrationEnv } from '../support/api';
import { db, resetCatalog, truncateAll } from '../support/db';

beforeAll(async () => {
  useFakeIntegrationEnv();
  await resetCatalog();
});
beforeEach(async () => {
  await truncateAll();
  getRecordingTransports().reset();
});

async function makeBooking(overrides: Record<string, unknown> = {}) {
  const res = await createBooking(postJson('/api/bookings', bookingBody(overrides)));
  expect(res.status).toBe(201);
  return db.booking.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
}

async function makeDue() {
  await db.integrationJob.updateMany({ where: { status: 'PENDING' }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
}

describe('outbox', () => {
  it('2. a booking survives email, Calendar and Sheets outages; errors are recorded for retry', async () => {
    const booking = await makeBooking();
    const down = new RecordingTransports();
    down.failing = new Set(['email', 'calendar', 'sheets']);

    const first = await processOutbox(db, { transports: down });
    expect(first).toEqual({ claimed: 4, completed: 0, retrying: 4, failed: 0 });

    const jobs = await db.integrationJob.findMany();
    expect(jobs.every((j) => j.status === 'PENDING' && j.attempts === 1 && j.lastError?.includes('unavailable'))).toBe(true);
    expect(jobs.every((j) => j.nextAttemptAt.getTime() > Date.now() + 50_000)).toBe(true); // 1-minute backoff
    // The booking itself is untouched.
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('REQUESTED');

    // Not due yet → nothing is processed.
    expect((await processOutbox(db, { transports: down })).claimed).toBe(0);

    // After the attempt budget is spent the jobs become FAILED (visible to OWNER/ADMIN).
    for (let i = 0; i < 4; i++) {
      await makeDue();
      await processOutbox(db, { transports: down });
    }
    const failed = await db.integrationJob.findMany();
    expect(failed.every((j) => j.status === 'FAILED' && j.attempts === 5)).toBe(true);
    expect(await db.booking.count()).toBe(1);

    // Manual retry from the CRM once the services are back.
    const healthy = new RecordingTransports();
    for (const job of failed) expect(await requeueJob(db, job.id)).toBe(true);
    expect(await processOutbox(db, { transports: healthy })).toMatchObject({ completed: 4, failed: 0 });
    expect(healthy.emails.map((e) => e.to).sort()).toEqual(['admin@example.test', 'client@example.test']);
    expect(healthy.sheets.size).toBe(1);
    expect(healthy.calendar.has(calendarEventId('b', booking.id))).toBe(true);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).googleCalendarEventId).toBe(calendarEventId('b', booking.id));
  });

  it('sends the client email in their language with escaped content, and error texts contain no personal data', async () => {
    await makeBooking({ locale: 'kk', name: '<script>x</script> Әсел', email: 'asel@example.test' });
    const t = new RecordingTransports();
    await processOutbox(db, { transports: t });
    const clientMail = t.emails.find((e) => e.to === 'asel@example.test')!;
    expect(clientMail.subject).toContain('қабылданды');
    expect(clientMail.html).toContain('&lt;script&gt;');
    expect(clientMail.html).not.toContain('<script>');

    await makeBooking({ time: '16:00', email: 'fail@example.test', phone: '+7 777 000 00 01' });
    const broken = new RecordingTransports();
    broken.sendEmail = async (m) => {
      throw new Error(`550 mailbox ${m.to} unavailable, call +7 777 000 00 01`);
    };
    await processOutbox(db, { transports: broken });
    const errors = (await db.integrationJob.findMany({ where: { lastError: { not: null } } })).map((j) => j.lastError).join(' ');
    expect(errors).toContain('550 mailbox');
    expect(errors).not.toContain('fail@example.test');
    expect(errors).not.toContain('777 000');
  });

  it('calendar sync is idempotent and follows cancellation', async () => {
    const booking = await makeBooking();
    const t = new RecordingTransports();
    await processOutbox(db, { transports: t });
    await processOutbox(db, { transports: t });
    expect(t.calendar.size).toBe(1);
    // A completed job is never run again.
    expect(await requeueJob(db, (await db.integrationJob.findFirstOrThrow({ where: { type: 'booking.calendar_sync' } })).id)).toBe(false);

    await db.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
    await db.integrationJob.create({
      data: { type: 'booking.calendar_sync', entityType: 'Booking', entityId: booking.id, idempotencyKey: `booking:${booking.id}:calendar_sync:cancel` },
    });
    const r = await processOutbox(db, { transports: t });
    const cancelJob = await db.integrationJob.findUniqueOrThrow({ where: { idempotencyKey: `booking:${booking.id}:calendar_sync:cancel` } });
    expect({ claimed: r.claimed, status: cancelJob.status, deletes: t.calendarDeletes.length }).toEqual({ claimed: 1, status: 'COMPLETED', deletes: 1 });
    expect(t.calendar.size).toBe(0);
  });

  it('parallel workers never process the same job twice', async () => {
    await makeBooking();
    const t = new RecordingTransports();
    const results = await Promise.all([processOutbox(db, { transports: t }), processOutbox(db, { transports: t }), processOutbox(db, { transports: t })]);
    expect(results.reduce((sum, r) => sum + r.claimed, 0)).toBe(4);
    expect(t.emails).toHaveLength(2);
  });

  it('20. the test environment never uses real transports', async () => {
    expect(getTransports().kind).toBe('recording');
    const res = await createTour(postJson('/api/tours', tourBody()));
    expect(res.status).toBe(201);
    // Processing without explicit transports goes to the in-memory recorder.
    await processOutbox(db);
    const recorder = getRecordingTransports();
    expect(recorder.emails.map((e) => e.to)).toEqual(['admin@example.test']);
    expect(recorder.calendar.size).toBe(1);
  });
});
