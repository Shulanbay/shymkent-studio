import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as createTour } from '@/app/api/tours/route';
import { futureDay, postJson, tourBody, useFakeIntegrationEnv } from '../support/api';
import { db, resetCatalog, truncateAll } from '../support/db';

beforeAll(async () => {
  useFakeIntegrationEnv();
  await resetCatalog();
});
beforeEach(truncateAll);

async function tour(overrides: Record<string, unknown> = {}, opts: Parameters<typeof postJson>[2] = {}) {
  const res = await createTour(postJson('/api/tours', tourBody(overrides), opts));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('POST /api/tours', () => {
  it('15. saves the client and the tour request, returns its number', async () => {
    const res = await tour();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ok: true, requestNumber: 'T-00001' });
    const saved = await db.tourRequest.findFirstOrThrow({ include: { client: true } });
    expect(saved.status).toBe('NEW');
    expect(saved.locale).toBe('KK');
    expect(saved.format).toBe('podcast');
    expect(saved.consentAt).not.toBeNull();
    expect(saved.scheduledAt.toISOString()).toBe(new Date(`${futureDay(6)}T15:00:00+05:00`).toISOString());
    expect(saved.scheduledEnd.getTime() - saved.scheduledAt.getTime()).toBe(15 * 60_000);
    expect(saved.client.normalizedPhone).toBe('+77010000002');
    expect(saved.client.source).toBe('website-tour');
    expect(await db.activityLog.count({ where: { action: 'tour.create' } })).toBe(1);
    expect((await db.integrationJob.findMany()).map((j) => j.type).sort()).toEqual(['tour.admin_email', 'tour.calendar_sync']);
  });

  it('reuses the client of an earlier booking or tour with the same phone', async () => {
    await tour({ phone: '87010000002' });
    await tour({ phone: '+7 (701) 000-00-02', time: '16:00' });
    expect(await db.client.count()).toBe(1);
    expect(await db.tourRequest.count()).toBe(2);
  });

  it('does not allow two tours at the same time (one host), even concurrently', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) => tour({ phone: `+7 707 000 00 0${i}` })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    expect((await tour({ time: '15:30', phone: '+7 707 000 00 09' })).status).toBe(201);
  });

  it('a cancelled tour frees the slot', async () => {
    await tour();
    await db.tourRequest.updateMany({ data: { status: 'CANCELLED' } });
    expect((await tour({ phone: '+7 707 111 11 11' })).status).toBe(201);
  });

  it('validates date, working hours, phone and consent', async () => {
    expect((await tour({ time: '07:00' })).body.error).toBe('OUTSIDE_HOURS');
    expect((await tour({ time: '15:10' })).body.error).toBe('OFF_GRID');
    expect((await tour({ date: '2020-01-01' })).body.error).toBe('PAST');
    expect((await tour({ phone: '12345' })).body.error).toBe('INVALID_PHONE');
    expect((await tour({ agreePrivacy: false })).status).toBe(422);
    expect((await tour({ format: 'rave' })).status).toBe(422);
    expect(await db.tourRequest.count()).toBe(0);
    expect(await db.client.count()).toBe(0);
  });

  it('16. honeypot and rate limiting protect the form', async () => {
    const spam = await tour({ website: 'x' });
    expect(spam.status).toBe(400);
    expect(await db.tourRequest.count()).toBe(0);

    const ip = '198.51.100.7';
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await tour({ time: `1${i}:00`, phone: `+7 708 000 00 0${i}` }, { ip })).status);
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('an idempotency key makes resubmits safe', async () => {
    const body = tourBody();
    const first = await createTour(postJson('/api/tours', body));
    const second = await createTour(postJson('/api/tours', body));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(await db.tourRequest.count()).toBe(1);
  });
});
