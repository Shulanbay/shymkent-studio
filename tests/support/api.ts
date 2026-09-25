import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { addDays, todayInStudio } from '@/lib/time';

// Fake integration configuration so jobs are enqueued deterministically.
// Nothing is ever sent: integrations run in dry-run mode under Vitest.
export function useFakeIntegrationEnv() {
  Object.assign(process.env, {
    SMTP_HOST: '',
    GMAIL_USER: 'robot@example.test',
    GMAIL_APP_PASSWORD: 'not-a-real-password',
    ADMIN_NOTIFICATION_EMAIL: 'admin@example.test',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_CALENDAR_ID: 'test-calendar@example.test',
    GOOGLE_CALENDAR_REFRESH_TOKEN: '',
    GOOGLE_APPS_SCRIPT_URL: 'https://example.invalid/sheets',
    AUTH_URL: 'http://localhost:3000',
  });
}

let ipCounter = 0;
/** A fresh client IP per call, so rate limits only kick in where a test wants them. */
export function nextIp() {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

export function postJson(path: string, body: unknown, opts: { ip?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host: 'localhost:3000',
    'x-forwarded-for': opts.ip ?? nextIp(),
  };
  if (opts.origin !== null) headers.origin = opts.origin ?? 'http://localhost:3000';
  return new NextRequest(`http://localhost:3000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

export function get(path: string, ip = nextIp()) {
  return new NextRequest(`http://localhost:3000${path}`, { headers: { host: 'localhost:3000', 'x-forwarded-for': ip } });
}

/** A day a few days ahead (inside the default 90-day horizon, open 10:00–22:00). */
export function futureDay(offset = 5) {
  return addDays(todayInStudio(), offset);
}

export function bookingBody(overrides: Record<string, unknown> = {}) {
  return {
    service: 'starter',
    room: 'large',
    date: futureDay(),
    time: '12:00',
    duration: 60,
    participants: 2,
    name: 'Тест Клиент',
    phone: '+7 700 000 00 01',
    email: 'client@example.test',
    comment: 'Тестовая заявка',
    agreeTerms: true,
    locale: 'ru',
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

export function tourBody(overrides: Record<string, unknown> = {}) {
  return {
    date: futureDay(6),
    time: '15:00',
    name: 'Гость Тура',
    phone: '+7 701 000 00 02',
    format: 'podcast',
    agreePrivacy: true,
    locale: 'kk',
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}
