import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';
import { getIntegrationConfig, isDryRun } from '@/lib/integrations/config';
import { bookingCreatedJobs, tourCreatedJobs } from '@/lib/outbox/jobs';
import { backoffMs } from '@/lib/outbox/process';
import { isHoneypotTriggered, publicBookingSchema } from '@/lib/public/schemas';

describe('outbox job planning', () => {
  const all = { email: true, adminEmail: 'admin@example.test', calendar: true, sheets: true };
  it('enqueues every configured integration once per booking', () => {
    const jobs = bookingCreatedJobs('b1', true, all);
    expect(jobs.map((j) => j.type)).toEqual(['booking.admin_email', 'booking.client_email', 'booking.calendar_sync', 'booking.sheets_sync']);
    expect(new Set(jobs.map((j) => j.idempotencyKey)).size).toBe(4);
  });
  it('skips what is not configured', () => {
    expect(bookingCreatedJobs('b1', false, { ...all, sheets: false, calendar: false }).map((j) => j.type)).toEqual(['booking.admin_email']);
    expect(bookingCreatedJobs('b1', true, { email: false, adminEmail: null, calendar: false, sheets: false })).toEqual([]);
    expect(tourCreatedJobs('t1', all).map((j) => j.type)).toEqual(['tour.admin_email', 'tour.calendar_sync']);
  });
  it('backs off exponentially up to one hour', () => {
    expect([1, 2, 3, 4, 5, 10].map((a) => backoffMs(a) / 60_000)).toEqual([1, 2, 4, 8, 16, 60]);
  });
  it('reads integration config from the environment', () => {
    expect(getIntegrationConfig({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASSWORD: 'p', NEXT_PUBLIC_EMAIL: 'x@y.z' } as unknown as NodeJS.ProcessEnv)).toEqual({
      email: true,
      adminEmail: 'x@y.z',
      calendar: false,
      sheets: false,
    });
  });
  it('never talks to real services under test', () => {
    expect(isDryRun()).toBe(true);
  });
});

describe('public booking validation', () => {
  const valid = {
    service: 'starter',
    room: 'large',
    date: '2026-11-20',
    time: '12:00',
    duration: 60,
    participants: 2,
    name: 'Айгерим',
    phone: '+7 700 123 45 67',
    agreeTerms: true,
    idempotencyKey: '3b241101-e2bb-4255-8caf-4136c566a962',
  };
  it('accepts a valid request and strips unknown fields such as a price', () => {
    const parsed = publicBookingSchema.parse({ ...valid, price: 1, totalAmount: 1 });
    expect(parsed).not.toHaveProperty('price');
    expect(parsed).not.toHaveProperty('totalAmount');
    expect(parsed.locale).toBe('ru');
  });
  it.each([
    ['name too long', { name: 'x'.repeat(101) }],
    ['comment too long', { comment: 'x'.repeat(1001) }],
    ['terms not accepted', { agreeTerms: false }],
    ['bad time', { time: '25:00' }],
    ['bad date', { date: '20.11.2026' }],
    ['bad idempotency key', { idempotencyKey: '123' }],
    ['too many participants', { participants: 50 }],
    ['bad email', { email: 'not-an-email' }],
    ['room injection', { room: 'large; DROP TABLE' }],
  ])('rejects: %s', (_label, patch) => {
    expect(publicBookingSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it('strips control characters from the name', () => {
    expect(publicBookingSchema.parse({ ...valid, name: 'Ай\u0000гер\nим' }).name).toBe('Айгер им');
  });
  it('detects the honeypot', () => {
    expect(isHoneypotTriggered({ website: 'http://spam' })).toBe(true);
    expect(isHoneypotTriggered({ website: '' })).toBe(false);
    expect(isHoneypotTriggered({})).toBe(false);
  });
});

describe('middleware (unauthenticated access)', () => {
  const req = (path: string, cookie?: string) =>
    new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });

  it('redirects /admin pages to the login page, keeping the target', () => {
    const res = middleware(req('/admin/bookings?status=NEW'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/login?next=%2Fadmin%2Fbookings%3Fstatus%3DNEW');
  });
  it('rejects admin API calls with 401', () => {
    expect(middleware(req('/api/admin/jobs')).status).toBe(401);
  });
  it('lets the login page through', () => {
    expect(middleware(req('/admin/login')).headers.get('location')).toBeNull();
  });
  it('lets the email sign-in link page through without a session, but not other admin pages', () => {
    expect(middleware(req('/admin/login/verify?token=abc')).headers.get('location')).toBeNull();
    expect(middleware(req('/admin/loginx')).status).toBe(307);
  });
  it('passes requests with a session cookie on to server-side validation, marked noindex', () => {
    const res = middleware(req('/admin', 'ss_admin=token'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});
