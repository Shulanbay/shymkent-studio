import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GET as availability } from '@/app/api/availability/route';
import { POST as createBooking } from '@/app/api/bookings/route';
import { SETTING_KEYS } from '@/lib/settings-schema';
import { DEFAULT_WORKING_HOURS } from '@/lib/settings-schema';
import { addDays, todayInStudio } from '@/lib/time';
import { bookingBody, futureDay, get, postJson, useFakeIntegrationEnv } from '../support/api';
import { db, resetCatalog, truncateAll } from '../support/db';

beforeAll(async () => {
  useFakeIntegrationEnv();
  await resetCatalog();
});
beforeEach(truncateAll);

async function book(overrides: Record<string, unknown> = {}, opts: Parameters<typeof postJson>[2] = {}) {
  const res = await createBooking(postJson('/api/bookings', bookingBody(overrides), opts));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('POST /api/bookings — happy path', () => {
  it('1. saves client + booking in PostgreSQL and returns the booking number only after commit', async () => {
    const res = await book();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ok: true, bookingNumber: 'SS-00001', status: 'REQUESTED' });

    const booking = await db.booking.findFirstOrThrow({ include: { client: true, room: true, service: true } });
    expect(booking.status).toBe('REQUESTED');
    expect(booking.source).toBe('website');
    expect(booking.locale).toBe('RU');
    expect(booking.termsAcceptedAt).not.toBeNull();
    expect(booking.termsVersion).toBeTruthy();
    expect(booking.room.slug).toBe('large');
    expect(booking.service.slug).toBe('starter');
    expect(booking.client.normalizedPhone).toBe('+77000000001');
    expect(booking.startAt.toISOString()).toBe(new Date(`${futureDay()}T12:00:00+05:00`).toISOString());
    expect(booking.endAt.getTime() - booking.startAt.getTime()).toBe(60 * 60_000);
    // Room buffers (15/15) are frozen into the blocked range.
    expect(booking.blockedFrom.toISOString()).toBe(new Date(`${futureDay()}T11:45:00+05:00`).toISOString());
    expect(booking.blockedUntil.toISOString()).toBe(new Date(`${futureDay()}T13:15:00+05:00`).toISOString());

    expect(await db.activityLog.count({ where: { action: 'booking.create', entityId: booking.id } })).toBe(1);
    const jobs = await db.integrationJob.findMany({ where: { entityId: booking.id } });
    expect(jobs.map((j) => j.type).sort()).toEqual(['booking.admin_email', 'booking.calendar_sync', 'booking.client_email', 'booking.sheets_sync']);
    expect(jobs.every((j) => j.status === 'PENDING')).toBe(true);
  });

  it('12/13. computes the price on the server and ignores a forged price', async () => {
    const res = await book({ duration: 90, price: 1, totalAmount: 1, total: 1 });
    expect(res.status).toBe(201);
    expect((await db.booking.findFirstOrThrow()).totalAmount).toBe(30_000);
    await book({ service: 'premium', duration: 90, time: '16:00', price: 5 });
    expect((await db.booking.findFirstOrThrow({ where: { service: { slug: 'premium' } } })).totalAmount).toBe(60_000);
  });

  it('accepts legacy tariff identifiers', async () => {
    const res = await book({ service: 'release', duration: 90 });
    expect(res.status).toBe(201);
    expect((await db.booking.findFirstOrThrow({ include: { service: true } })).service.slug).toBe('pro');
  });
});

describe('clients', () => {
  it('4/5. one client per phone, whatever the format', async () => {
    const phones = ['+7 700 123 45 67', '87001234567', '8 (700) 123-45-67', '7001234567'];
    for (const [i, phone] of phones.entries()) {
      const res = await book({ phone, time: `${12 + i * 2}:00`, name: `Имя ${i}` });
      expect(res.status).toBe(201);
    }
    const clients = await db.client.findMany();
    expect(clients).toHaveLength(1);
    expect(clients[0].normalizedPhone).toBe('+77001234567');
    expect(clients[0].name).toBe('Имя 0'); // existing client's name is not overwritten by later forms
    expect(await db.booking.count({ where: { clientId: clients[0].id } })).toBe(4);
  });

  it('3. a booking cannot exist without a client', async () => {
    const room = await db.room.findUniqueOrThrow({ where: { slug: 'large' } });
    const service = await db.service.findUniqueOrThrow({ where: { slug: 'pro' } });
    const start = new Date(`${futureDay()}T12:00:00+05:00`);
    await expect(
      db.booking.create({
        data: {
          clientId: 'missing-client',
          roomId: room.id,
          serviceId: service.id,
          startAt: start,
          endAt: new Date(start.getTime() + 3600_000),
          blockedFrom: start,
          blockedUntil: new Date(start.getTime() + 3600_000),
          participants: 1,
          totalAmount: 1,
        },
      }),
    ).rejects.toThrow(/Foreign key constraint/);
    // An invalid public request creates neither a client nor a booking.
    expect((await book({ name: '' })).status).toBe(422);
    expect(await db.client.count()).toBe(0);
  });
});

describe('availability and conflicts', () => {
  it('6. an occupied slot returns 409', async () => {
    expect((await book()).status).toBe(201);
    const res = await book({ phone: '+7 701 111 11 11' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SLOT_TAKEN');
    expect(String(res.body.message)).toContain('заняли');
    expect(await db.booking.count()).toBe(1);
  });

  it('7. five concurrent requests for one slot create exactly one booking', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => book({ phone: `+7 702 000 00 1${i}`, time: '17:00' })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await db.booking.count()).toBe(1);
  });

  it('8. room buffers block the neighbouring slot', async () => {
    expect((await book({ time: '12:00' })).status).toBe(201); // blocked 11:45–13:15
    expect((await book({ time: '13:00', phone: '+7 701 000 00 03' })).status).toBe(409);
    expect((await book({ time: '11:00', phone: '+7 701 000 00 04' })).status).toBe(409);
    expect((await book({ time: '13:30', phone: '+7 701 000 00 05' })).status).toBe(201);
    // Another room is independent.
    expect((await book({ time: '12:00', room: 'small', phone: '+7 701 000 00 06' })).status).toBe(201);
  });

  it('9. a cancelled booking does not block the slot', async () => {
    expect((await book()).status).toBe(201);
    await db.booking.updateMany({ data: { status: 'CANCELLED' } });
    expect((await book({ phone: '+7 701 000 00 07' })).status).toBe(201);
  });

  it('10. rejects past dates', async () => {
    const res = await book({ date: addDays(todayInStudio(), -1) });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('PAST');
  });

  it('11. rejects times outside working hours, off-grid times and closed days', async () => {
    expect((await book({ time: '08:00' })).body.error).toBe('OUTSIDE_HOURS');
    expect((await book({ time: '21:30' })).body.error).toBe('OUTSIDE_HOURS');
    expect((await book({ time: '12:10' })).body.error).toBe('OFF_GRID');
    await db.setting.create({
      data: { key: SETTING_KEYS.workingHours, value: { ...DEFAULT_WORKING_HOURS, exceptions: { [futureDay()]: null } } },
    });
    const closed = await book();
    expect(closed.status).toBe(422);
    expect(closed.body.error).toBe('CLOSED');
    expect(await db.booking.count()).toBe(0);
  });

  it('checks room capacity and tariff durations', async () => {
    expect((await book({ room: 'small', participants: 3 })).body.error).toBe('CAPACITY');
    expect((await book({ service: 'pro', duration: 60 })).body.error).toBe('INVALID_DURATION');
    expect((await book({ duration: 75 })).body.error).toBe('INVALID_DURATION');
    expect((await book({ room: 'nope' })).body.error).toBe('ROOM_UNAVAILABLE');
    await db.service.update({ where: { slug: 'premium' }, data: { active: false } });
    expect((await book({ service: 'premium', duration: 90 })).body.error).toBe('SERVICE_UNAVAILABLE');
    await db.service.update({ where: { slug: 'premium' }, data: { active: true } });
  });

  it('GET /api/availability lists only free future slots, without personal data', async () => {
    await book({ time: '12:00' });
    const res = await availability(get(`/api/availability?room=large&service=starter&date=${futureDay()}&duration=60`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['date', 'durationMinutes', 'slots', 'timeZone']);
    const times = body.slots.map((s: { time: string }) => s.time);
    expect(times).toContain('10:00');
    expect(times).not.toContain('12:00');
    expect(times).not.toContain('13:00');
    expect(times).toContain('13:30');
    expect(JSON.stringify(body)).not.toMatch(/Тест|\+7|example\.test/);
    expect(res.headers.get('cache-control')).toContain('max-age=10');

    const bad = await availability(get('/api/availability?room=large&service=starter&date=tomorrow'));
    expect(bad.status).toBe(422);
    const tours = await availability(get(`/api/availability?kind=tour&date=${futureDay()}`));
    expect((await tours.json()).durationMinutes).toBe(15);
  });
});

describe('idempotency', () => {
  it('14. a repeated idempotency key returns the same booking and creates nothing new', async () => {
    const key = randomUUID();
    const first = await book({ idempotencyKey: key });
    const second = await book({ idempotencyKey: key });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ bookingNumber: first.body.bookingNumber, duplicate: true });
    expect(await db.booking.count()).toBe(1);
    expect(await db.integrationJob.count()).toBe(4);
  });

  it('a double click (concurrent identical requests) creates one booking', async () => {
    const key = randomUUID();
    const results = await Promise.all([book({ idempotencyKey: key }), book({ idempotencyKey: key }), book({ idempotencyKey: key })]);
    expect(new Set(results.map((r) => r.body.bookingNumber))).toEqual(new Set(['SS-00001']));
    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(await db.booking.count()).toBe(1);
  });
});

describe('abuse protection', () => {
  it('16a. the honeypot rejects bots without saving anything', async () => {
    const res = await book({ website: 'https://spam.example' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('REJECTED');
    expect(await db.booking.count()).toBe(0);
    expect(await db.client.count()).toBe(0);
    expect(await db.activityLog.count({ where: { action: 'spam.honeypot.booking' } })).toBe(1);
  });

  it('16b. rate limit: the 6th request from one IP within 10 minutes gets 429', async () => {
    const ip = '203.0.113.50';
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await book({ time: `${10 + i * 2}:00`, phone: `+7 705 000 00 0${i}` }, { ip })).status);
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
    expect(await db.booking.count()).toBe(5);
    expect((await book({}, { ip: '203.0.113.51' })).status).not.toBe(429);
  });

  it('without a proxy-supplied IP, visitors share a larger bucket instead of locking each other out', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await book({ time: `${10 + i}:00`, room: i % 2 ? 'small' : 'large', phone: `+7 706 000 00 0${i}` }, { ip: '' })).status);
    expect(statuses).not.toContain(429);
  });

  it('requires a same-origin request (CSRF)', async () => {
    expect((await book({}, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await book({}, { origin: null })).status).toBe(403);
    expect(await db.booking.count()).toBe(0);
  });

  it('rejects oversized and malformed bodies without leaking internals', async () => {
    const huge = await createBooking(postJson('/api/bookings', { ...bookingBody(), comment: 'x'.repeat(20_000) }));
    expect(huge.status).toBe(422);
    const res = await book({ phone: 'abc' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('INVALID_PHONE');
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|stack|at /i);
  });

  it('answers in Kazakh when the form is in Kazakh', async () => {
    await book();
    const res = await book({ locale: 'kk', phone: '+7 701 999 99 99' });
    expect(res.status).toBe(409);
    expect(String(res.body.message)).toContain('Басқа уақытты');
  });
});
