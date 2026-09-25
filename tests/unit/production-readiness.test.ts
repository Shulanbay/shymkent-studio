import { describe, expect, it } from 'vitest';
import { GET as health } from '@/app/api/health/route';
import { addressFor, formatLongDate, isBeforeOpening, phoneHref } from '@/lib/contacts';
import { validateEnv } from '@/lib/env-schema';
import { clientIpFromHeaders } from '@/lib/http';
import { redact } from '@/lib/log';
import { ROOM_CONTENT } from '@/lib/rooms-content';
import { DEFAULT_STUDIO_CONTACTS, studioContactsSchema } from '@/lib/settings-schema';
import { getTranslation } from '@/lib/translations';
import kk from '@/public/translations/kk.json';
import ru from '@/public/translations/ru.json';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { securityHeaders } = require('../../security-headers.js');

const strong = 'Zx9-kq2W7pL0mN4vB8cR1tY6uI3oP5aS7dF2gH';
const prodEnv = (overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:pw@db.internal:5432/shymkent?sslmode=require',
  AUTH_SECRET: strong,
  CRON_SECRET: `${strong}-cron`,
  AUTH_URL: 'https://shymkent.studio',
  NEXT_PUBLIC_SITE_URL: 'https://shymkent.studio',
  ...overrides,
});

describe('environment validation', () => {
  it('accepts a complete production configuration', () => {
    const r = validateEnv(prodEnv());
    expect(r.errors).toEqual([]);
  });
  it('requires DATABASE_URL and a long AUTH_SECRET everywhere', () => {
    const r = validateEnv({ NODE_ENV: 'development', AUTH_SECRET: 'short' });
    expect(r.errors.join(' ')).toMatch(/DATABASE_URL is required/);
    expect(r.errors.join(' ')).toMatch(/AUTH_SECRET must be at least 32/);
  });
  it('keeps local development convenient (http://localhost, no cron secret)', () => {
    const r = validateEnv({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://u:p@localhost:5432/dev', AUTH_SECRET: strong, AUTH_URL: 'http://localhost:3000' });
    expect(r.errors).toEqual([]);
  });
  it.each([
    [{ AUTH_URL: 'http://localhost:3000' }, /AUTH_URL must be a public https/],
    [{ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }, /NEXT_PUBLIC_SITE_URL must be a public https/],
    [{ AUTH_URL: undefined }, /AUTH_URL is required/],
    [{ CRON_SECRET: 'too-short-cron-secret' }, /CRON_SECRET must be at least 32/],
    [{ CRON_SECRET: undefined }, /CRON_SECRET is required in production/],
    [{ CRON_SECRET: strong }, /must differ from AUTH_SECRET/],
    [{ AUTH_SECRET: 'change-me-change-me-change-me-change-me' }, /placeholder/],
    [{ DATABASE_URL: 'mysql://x@y/z' }, /postgresql/],
    [{ SMTP_HOST: 'smtp.example.test' }, /SMTP is partly configured/],
    [{ GMAIL_USER: 'robot@example.test' }, /Gmail is partly configured/],
    [{ GOOGLE_CALENDAR_ID: 'cal@example.test' }, /GOOGLE_CLIENT_ID/],
    [{ GOOGLE_CLIENT_ID: 'id' }, /partly configured/],
    [{ GOOGLE_APPS_SCRIPT_URL: 'http://script.google.com/x' }, /https/],
    [{ SMTP_PORT: 'abc' }, /SMTP_PORT must be a whole number/],
  ])('rejects unsafe production setting %o', (overrides, message) => {
    expect(validateEnv(prodEnv(overrides)).errors.join(' ')).toMatch(message);
  });
  it('allows a local production-mode run (E2E) with APP_ENV=local', () => {
    const r = validateEnv(prodEnv({ APP_ENV: 'local', AUTH_URL: 'http://localhost:3100', NEXT_PUBLIC_SITE_URL: 'http://localhost:3100', CRON_SECRET: undefined }));
    expect(r.errors).toEqual([]);
  });
  it('reports configured integrations and never echoes secret values', () => {
    const env = prodEnv({ SMTP_HOST: 'smtp.example.test', SMTP_USER: 'u', SMTP_PASSWORD: 'super-secret-smtp-password', ADMIN_NOTIFICATION_EMAIL: 'a@example.test' });
    const r = validateEnv(env);
    expect(r.integrations).toEqual({ email: true, calendar: false, sheets: false });
    expect(JSON.stringify(r)).not.toContain('super-secret-smtp-password');
    expect(JSON.stringify(validateEnv(prodEnv({ AUTH_SECRET: 'x'.repeat(10) })))).not.toContain('xxxxxxxxxx');
  });
});

describe('client IP behind trusted proxies', () => {
  const h = (xff?: string, real?: string) => new Headers({ ...(xff ? { 'x-forwarded-for': xff } : {}), ...(real ? { 'x-real-ip': real } : {}) });
  it('takes the address added by the trusted proxy, not a client-supplied one', () => {
    expect(clientIpFromHeaders(h('6.6.6.6, 203.0.113.7'), { TRUSTED_PROXY_COUNT: '1' })).toBe('203.0.113.7');
    expect(clientIpFromHeaders(h('6.6.6.6, 203.0.113.7, 10.0.0.1'), { TRUSTED_PROXY_COUNT: '2' })).toBe('203.0.113.7');
    expect(clientIpFromHeaders(h('203.0.113.7'), {})).toBe('203.0.113.7');
  });
  it('falls back to X-Real-IP, ignores garbage and can be disabled', () => {
    expect(clientIpFromHeaders(h(undefined, '198.51.100.2'), {})).toBe('198.51.100.2');
    expect(clientIpFromHeaders(h('<script>'), {})).toBe('unknown');
    expect(clientIpFromHeaders(h('203.0.113.7'), { TRUSTED_PROXY_COUNT: '0' })).toBe('unknown');
    expect(clientIpFromHeaders(h(), {})).toBe('unknown');
  });
});

describe('structured logs redact personal data and secrets', () => {
  it('removes sensitive keys and scrubs emails / phones / tokens from strings', () => {
    const out = JSON.stringify(
      redact({
        email: 'client@example.test',
        phone: '+7 701 000 00 00',
        password: 'hunter2hunter2',
        note: 'call +7 701 000 00 00 or client@example.test',
        token: 'ya29.a0AfH6SMBxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        integrations: { email: true },
        error: new Error('SMTP rejected client@example.test'),
      }),
    );
    expect(out).not.toMatch(/client@example\.test|701 000|hunter2|ya29/);
    expect(out).toContain('"integrations":{"email":true}');
  });
});

describe('translations (RU / KK)', () => {
  const flat = (o: Record<string, unknown>, p = ''): [string, string][] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v ? flat(v as Record<string, unknown>, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
  const ruMap = new Map(flat(ru));
  const kkMap = new Map(flat(kk));
  it('have exactly the same keys and no empty texts', () => {
    expect([...kkMap.keys()].sort()).toEqual([...ruMap.keys()].sort());
    for (const [key, value] of [...ruMap, ...kkMap]) {
      if (!['booking.agreeBefore'].includes(key)) expect(value.trim(), key).not.toBe('');
    }
  });
  it('use the same {placeholders} in both languages', () => {
    for (const [key, value] of ruMap) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(vars(kkMap.get(key)!), key).toBe(vars(value));
    }
  });
  it('never show a raw key and fall back to Russian', () => {
    expect(getTranslation('kk', 'header.book')).toBe('Брондау');
    expect(getTranslation('kk', 'no.such.key')).toBe('no.such.key');
  });
  it('use «Кіші бөлме» for the small room and no known machine-translation errors', () => {
    expect(getTranslation('kk', 'roomsDescriptions.smallTitle')).toBe('Кіші бөлме');
    const all = [...kkMap.values()].join(' ');
    expect(all).not.toMatch(/қоршағын|құнсыз|один|Қосымша бөлме|қосымша төлемсіз/);
  });
  it('every room card text exists', () => {
    for (const room of ROOM_CONTENT) for (const key of [room.titleKey, room.descKey, ...room.featureKeys]) expect(ruMap.has(key), key).toBe(true);
  });
});

describe('studio contacts (CRM settings)', () => {
  it('older stored values without the new fields still parse, with safe defaults', () => {
    const old = { email: 'a@example.test', phone: '+7 700 000 00 00', whatsapp: '77000000000', instagram: 'studio', city: 'Шымкент', address: 'ул. Тест, 1' };
    const parsed = studioContactsSchema.parse(old);
    expect(parsed).toMatchObject({ studioName: 'SHYMKENT STUDIO', mapUrl: '', openingDate: '', addressKk: '' });
  });
  it('rejects a non-https map link and an Instagram URL instead of a handle', () => {
    expect(studioContactsSchema.safeParse({ ...DEFAULT_STUDIO_CONTACTS, mapUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(studioContactsSchema.safeParse({ ...DEFAULT_STUDIO_CONTACTS, instagram: 'https://instagram.com/x' }).success).toBe(false);
  });
  it('formats address, phone link and opening date for the site', () => {
    expect(addressFor({ city: 'Шымкент', address: 'ул. А, 1', addressKk: 'А көшесі, 1' }, 'kk')).toBe('Шымкент, А көшесі, 1');
    expect(addressFor({ city: 'Шымкент', address: 'ул. А, 1', addressKk: '' }, 'kk')).toBe('Шымкент, ул. А, 1');
    expect(phoneHref('+7 700 503 05 01')).toBe('tel:+77005030501');
    expect(phoneHref('8 700 503 05 01')).toBe('tel:+77005030501');
    expect(isBeforeOpening('2026-11-10', '2026-09-25')).toBe(true);
    expect(isBeforeOpening('2026-11-10', '2026-11-10')).toBe(false);
    expect(isBeforeOpening('', '2026-09-25')).toBe(false);
    expect(formatLongDate('2026-11-10', 'ru')).toBe('10 ноября 2026 года');
    expect(formatLongDate('2026-11-10', 'kk')).toBe('2026 жылғы 10 қараша');
  });
});

describe('health endpoint and headers', () => {
  it('health answers ok without any details', async () => {
    const res = health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
  it('CSP allows only self-hosted fonts and YouTube thumbnails/frames as third parties', () => {
    const csp = Object.fromEntries(securityHeaders({ isProd: true, https: true }).map((x: { key: string; value: string }) => [x.key, x.value]))[
      'Content-Security-Policy'
    ] as string;
    expect(csp).not.toContain('fonts.googleapis.com');
    expect(csp).toContain("img-src 'self' data: blob: https://i.ytimg.com");
    expect(csp).toContain('https://www.youtube-nocookie.com');
    expect(csp).toContain('upgrade-insecure-requests');
  });
});
