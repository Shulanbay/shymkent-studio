import { describe, expect, it } from 'vitest';
import { derivePaymentStatus } from '@/lib/admin/payments';
import { templateDueAt } from '@/lib/admin/production';
import { parseStudioDateTime } from '@/lib/admin/zod-helpers';
import { canWorkOnTask } from '@/lib/auth/permissions';
import { clientEmail, type ClientEmailKind } from '@/lib/notifications/templates';
import { isAuthorizedCron } from '@/lib/outbox/cron-auth';
import { bookingConfirmedJobs, bookingRescheduledJobs, paymentLinkJobs } from '@/lib/outbox/jobs';
import { PUBLIC_PATHS } from '@/lib/seo';
import { DEFAULT_PRODUCTION_TEMPLATES, DEFAULT_REMINDER_RULES } from '@/lib/settings-schema';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { securityHeaders, privateHeaders } = require('../../security-headers.js');

const cfg = { email: true, adminEmail: 'admin@example.test', calendar: true, sheets: true };
const ctx = { config: cfg, hasClientEmail: true };

describe('payment status (derived only from the ledger)', () => {
  it.each([
    [40_000, 0, false, 'UNPAID'],
    [40_000, 10_000, false, 'PARTIALLY_PAID'],
    [40_000, 40_000, false, 'PAID'],
    [40_000, 0, true, 'REFUNDED'],
    [40_000, 30_000, true, 'PARTIALLY_PAID'],
  ] as const)('total %i, net paid %i, refund %s → %s', (total, paid, refund, status) => {
    expect(derivePaymentStatus(total, paid, refund)).toBe(status);
  });
});

describe('production templates', () => {
  it('have deadlines relative to the session', () => {
    const booking = { startAt: new Date('2026-11-20T07:00:00Z'), endAt: new Date('2026-11-20T08:30:00Z') };
    const pro = DEFAULT_PRODUCTION_TEMPLATES.pro;
    expect(templateDueAt(pro.find((t) => t.key === 'prep')!, booking).toISOString()).toBe('2026-11-19T07:00:00.000Z');
    expect(templateDueAt(pro.find((t) => t.key === 'editing')!, booking).toISOString()).toBe('2026-11-23T08:30:00.000Z');
    expect(new Set(pro.map((t) => t.key)).size).toBe(pro.length);
  });
});

describe('13. task permissions by role', () => {
  const op = { id: 'op', role: 'OPERATOR' as const };
  const ed = { id: 'ed', role: 'EDITOR' as const };
  const mgr = { id: 'mgr', role: 'MANAGER' as const };
  it('OPERATOR works only on own preparation/recording tasks', () => {
    expect(canWorkOnTask(op, { type: 'RECORDING', assignedToId: 'op' })).toBe(true);
    expect(canWorkOnTask(op, { type: 'PREPARATION', assignedToId: 'op' })).toBe(true);
    expect(canWorkOnTask(op, { type: 'EDITING', assignedToId: 'op' })).toBe(false);
    expect(canWorkOnTask(op, { type: 'RECORDING', assignedToId: 'someone-else' })).toBe(false);
  });
  it('EDITOR works only on own editing/shorts/thumbnail/review/delivery tasks', () => {
    for (const type of ['EDITING', 'SHORTS', 'THUMBNAIL', 'REVIEW', 'DELIVERY']) expect(canWorkOnTask(ed, { type, assignedToId: 'ed' })).toBe(true);
    expect(canWorkOnTask(ed, { type: 'RECORDING', assignedToId: 'ed' })).toBe(false);
    expect(canWorkOnTask(ed, { type: 'EDITING', assignedToId: null })).toBe(false);
  });
  it('MANAGER can work on any task', () => {
    expect(canWorkOnTask(mgr, { type: 'PUBLISHING', assignedToId: null })).toBe(true);
  });
});

describe('lifecycle job planning', () => {
  const now = new Date('2026-11-10T05:00:00Z');
  const start = new Date('2026-11-20T07:00:00Z');
  it('confirmation plans the email, 24h/2h reminders at the right time, and a calendar update', () => {
    const jobs = bookingConfirmedJobs('b1', start, now, ctx, DEFAULT_REMINDER_RULES);
    expect(jobs.map((j) => j.type)).toEqual(['booking.confirmed_email', 'booking.reminder_24h', 'booking.reminder_2h', 'booking.calendar_sync', 'booking.sheets_sync']);
    expect(jobs.find((j) => j.type === 'booking.reminder_24h')!.runAt!.toISOString()).toBe('2026-11-19T07:00:00.000Z');
    expect(jobs.find((j) => j.type === 'booking.reminder_2h')!.runAt!.toISOString()).toBe('2026-11-20T05:00:00.000Z');
  });
  it('skips reminders that are already in the past and emails without an address', () => {
    const late = bookingConfirmedJobs('b1', start, new Date('2026-11-20T04:00:00Z'), ctx, DEFAULT_REMINDER_RULES);
    expect(late.map((j) => j.type)).not.toContain('booking.reminder_24h');
    expect(late.map((j) => j.type)).toContain('booking.reminder_2h');
    expect(bookingConfirmedJobs('b1', start, now, { config: cfg, hasClientEmail: false }, DEFAULT_REMINDER_RULES).map((j) => j.type)).toEqual([
      'booking.calendar_sync',
      'booking.sheets_sync',
    ]);
  });
  it('uses stable idempotency keys (same event → same key)', () => {
    const a = bookingRescheduledJobs('b1', start, true, now, ctx, DEFAULT_REMINDER_RULES);
    const b = bookingRescheduledJobs('b1', start, true, new Date(now.getTime() + 5000), ctx, DEFAULT_REMINDER_RULES);
    expect(a.map((j) => j.idempotencyKey)).toEqual(b.map((j) => j.idempotencyKey));
    expect(paymentLinkJobs('b1', 'https://pay.example/a', ctx)[0].idempotencyKey).toBe(paymentLinkJobs('b1', 'https://pay.example/a', ctx)[0].idempotencyKey);
    expect(paymentLinkJobs('b1', 'https://pay.example/a', ctx)[0].idempotencyKey).not.toBe(paymentLinkJobs('b1', 'https://pay.example/b', ctx)[0].idempotencyKey);
  });
});

describe('client lifecycle emails', () => {
  const kinds: ClientEmailKind[] = [
    'received', 'confirmed', 'payment_link', 'rescheduled', 'cancelled', 'reminder_24h', 'reminder_2h', 'ready',
    'tour_confirmed', 'tour_rescheduled', 'tour_cancelled', 'tour_reminder',
  ];
  it.each(kinds.flatMap((k) => [[k, 'ru'], [k, 'kk']] as const))('%s (%s) renders, escapes input and uses studio contacts', (kind, lang) => {
    const email = clientEmail(kind, lang, {
      number: 'SS-00001',
      clientName: '<img src=x onerror=alert(1)>',
      date: '20.11.2026',
      time: '12:00–13:00',
      total: 40_000,
      linkUrl: 'https://pay.kaspi.kz/x?a=1&b=2',
      contacts: { studioName: 'SHYMKENT STUDIO', email: 'hello@example.test', phone: '+7 700 000 00 00', whatsapp: '77000000000', instagram: 'studio', city: 'Шымкент', address: '', addressKk: '', mapUrl: '', openingDate: '' },
    });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).not.toContain('<img');
    expect(email.html).toContain('hello@example.test');
    expect(email.html).not.toMatch(/налич/i);
  });
  it('never renders non-http links', () => {
    const email = clientEmail('payment_link', 'ru', { number: 'SS-1', clientName: 'A', date: 'd', time: 't', linkUrl: 'javascript:alert(1)' });
    expect(email.html).not.toContain('javascript:');
  });
});

describe('20. cron authorisation', () => {
  const secret = 'a-very-long-cron-secret-value-0123456789';
  it('accepts only the exact bearer secret', () => {
    expect(isAuthorizedCron(`Bearer ${secret}`, secret)).toBe(true);
    expect(isAuthorizedCron(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorizedCron(secret, secret)).toBe(false);
    expect(isAuthorizedCron(null, secret)).toBe(false);
  });
  it('is disabled when the secret is missing or too short', () => {
    expect(isAuthorizedCron('Bearer ', '')).toBe(false);
    expect(isAuthorizedCron('Bearer short', 'short')).toBe(false);
    expect(isAuthorizedCron('Bearer 0123456789abcdef0123456789', '0123456789abcdef0123456789')).toBe(false);
    expect(isAuthorizedCron('Bearer undefined', undefined)).toBe(false);
  });
});

describe('datetime-local inputs are Almaty time', () => {
  it('parses "YYYY-MM-DDTHH:MM" as UTC+5 regardless of the server time zone', () => {
    expect(parseStudioDateTime('2026-11-20T15:00')!.toISOString()).toBe('2026-11-20T10:00:00.000Z');
    expect(parseStudioDateTime('')).toBeUndefined();
  });
});

describe('24–26. SEO and security headers', () => {
  it('24. the sitemap never lists admin or API URLs', () => {
    expect(PUBLIC_PATHS.some((p) => p.startsWith('/admin') || p.startsWith('/api'))).toBe(false);
    expect(PUBLIC_PATHS).toContain('/book');
  });
  it('25. private routes are noindex and not cached', () => {
    const map = Object.fromEntries(privateHeaders.map((h: { key: string; value: string }) => [h.key, h.value]));
    expect(map['X-Robots-Tag']).toBe('noindex, nofollow');
    expect(map['Cache-Control']).toContain('no-store');
  });
  it('26. security headers: CSP with YouTube frames, no framing of the site, nosniff, referrer and permissions policy', () => {
    const prod = Object.fromEntries(securityHeaders({ isProd: true, https: true }).map((h: { key: string; value: string }) => [h.key, h.value]));
    expect(prod['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(prod['Content-Security-Policy']).toContain('https://www.youtube.com');
    expect(prod['Content-Security-Policy']).toContain("object-src 'none'");
    expect(prod['Content-Security-Policy']).not.toContain('unsafe-eval');
    expect(prod['X-Content-Type-Options']).toBe('nosniff');
    expect(prod['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(prod['Permissions-Policy']).toContain('camera=()');
    expect(prod['Strict-Transport-Security']).toContain('max-age=');
    const dev = Object.fromEntries(securityHeaders({ isProd: false, https: false }).map((h: { key: string; value: string }) => [h.key, h.value]));
    expect(dev['Strict-Transport-Security']).toBeUndefined();
  });
});
