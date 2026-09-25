import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { addDays, todayInStudio } from '../lib/time';
import { readState } from './env';

// Full business scenario in dry-run mode, in order. Only test identities are
// used (@example.test, fictional phone numbers); everything lives in the
// temporary E2E database that the teardown drops.

test.describe.configure({ mode: 'serial' });

const state = readState();
const db = new PrismaClient({ datasourceUrl: state.databaseUrl });
const STAFF_PASSWORD = 'E2e-Staff-Password-2026';
const manager = { name: 'E2E Менеджер', email: 'manager-e2e@example.test' };
const editor = { name: 'E2E Монтажёр', email: 'editor-e2e@example.test' };
const tourGuest = { name: 'E2E Гость Тура', phone: '+7 701 555 00 21' };
const bookingClient = { name: 'E2E Клиент', phone: '+7 701 555 00 11', email: 'client-e2e@example.test' };

let owner: Page;
let bookingNumber = '';
let bookingId = '';
let bookedDate = '';
let bookedTime = '';

async function login(page: Page, email: string, password: string) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/);
}

async function newStaffPage(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, email, STAFF_PASSWORD);
  return page;
}

async function expectNoHorizontalScroll(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `horizontal scroll on ${path}`).toBeLessThanOrEqual(1);
}

test.beforeAll(async ({ browser }) => {
  owner = await (await browser.newContext()).newPage();
  owner.on('dialog', (dialog) => dialog.accept());
});

test.afterAll(async () => {
  await db.$disconnect();
});

test('1. owner signs in', async () => {
  await login(owner, state.ownerEmail, state.ownerPassword);
  await expect(owner.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
});

test('2. owner creates staff accounts', async () => {
  await owner.goto('/admin/users');
  for (const [person, role] of [
    [manager, 'MANAGER'],
    [editor, 'EDITOR'],
  ] as const) {
    await owner.locator('#new-name').fill(person.name);
    await owner.locator('#new-email').fill(person.email);
    await owner.locator('#new-role').selectOption(role);
    await owner.locator('#new-password').fill(STAFF_PASSWORD);
    await owner.getByRole('button', { name: 'Добавить' }).click();
    await expect(owner.getByRole('status')).toContainText(/добавлен|создан/i);
    await expect(owner.locator('#new-name')).toHaveValue('');
  }
  await owner.reload();
  await expect(owner.getByText(manager.email)).toBeVisible();
});

test('3. staff permissions are enforced on the server', async ({ browser }) => {
  const ed = await newStaffPage(browser, editor.email);
  await expect(ed.getByRole('navigation', { name: 'Разделы CRM' }).getByRole('link', { name: 'Платежи' })).toHaveCount(0);
  for (const path of ['/admin/payments', '/admin/users', '/admin/bookings', '/admin/settings', '/admin/leads']) {
    await ed.goto(path);
    await expect(ed, `editor must not open ${path}`).toHaveURL(/\/admin\/forbidden/);
  }
  const oauth = await ed.request.get('/api/auth/login', { maxRedirects: 0 });
  expect(oauth.status()).toBe(403);

  const mg = await newStaffPage(browser, manager.email);
  await mg.goto('/admin/users');
  await expect(mg).toHaveURL(/\/admin\/forbidden/);
  await mg.goto('/admin/bookings');
  await expect(mg.getByRole('heading', { name: 'Заказы' })).toBeVisible();
  await ed.context().close();
  await mg.context().close();
});

test('4. public tour request is saved', async ({ page }) => {
  await page.goto('/studio-tour');
  await page.locator('#tour-date').fill(addDays(todayInStudio(), 7));
  const slot = page.locator('label:has(input[name="tour-time"])').first();
  await expect(slot).toBeVisible();
  await slot.click();
  await page.locator('#tour-name').fill(tourGuest.name);
  await page.locator('#tour-phone').fill(tourGuest.phone);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Записаться на бесплатный тур/ }).click();
  await expect(page.getByText(/T-\d{5}/)).toBeVisible();
});

test('5. the tour created a client and a lead in the CRM', async () => {
  await owner.goto('/admin/leads?view=list');
  await expect(owner.getByText(tourGuest.name).first()).toBeVisible();
  await owner.goto(`/admin/clients?q=${encodeURIComponent('555 00 21')}`);
  await expect(owner.getByText(tourGuest.name).first()).toBeVisible();
  await owner.goto('/admin/tours');
  await expect(owner.getByText(tourGuest.name).first()).toBeVisible();
});

test('6. manager works the lead', async () => {
  const lead = await db.lead.findFirstOrThrow({ where: { client: { name: tourGuest.name } } });
  await owner.goto(`/admin/leads/${lead.id}`);
  await owner.locator('#status').selectOption('CONTACTED');
  await owner.getByRole('button', { name: 'Сменить' }).click();
  await expect(owner.getByRole('status').first()).toBeVisible();
  await expect.poll(async () => (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('CONTACTED');
});

test('7. public online booking', async ({ page }) => {
  await page.goto('/book?service=starter&room=small');
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('button', { name: 'Далее' }).click();
  bookedDate = addDays(todayInStudio(), 8);
  await page.locator('#date').fill(bookedDate);
  const slot = page.locator('label:has(input[name="time"])').first();
  await expect(slot).toBeVisible();
  bookedTime = (await slot.innerText()).trim();
  await slot.click();
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.locator('#name').fill(bookingClient.name);
  await page.locator('#phone').fill(bookingClient.phone);
  await page.locator('#email').fill(bookingClient.email);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Проверить заявку' }).click();
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  const number = page.getByText(/SS-\d{5}/).first();
  await expect(number).toBeVisible();
  bookingNumber = ((await number.innerText()).match(/SS-\d{5}/) ?? [''])[0];
  expect(bookingNumber).toMatch(/SS-\d{5}/);
  const booking = await db.booking.findFirstOrThrow({ where: { client: { name: bookingClient.name } } });
  bookingId = booking.id;
  expect(booking.totalAmount).toBe(20000);
});

test('8. an occupied slot is rejected with 409', async ({ page }) => {
  await page.goto('/');
  const res = await page.request.post('/api/bookings', {
    headers: { origin: 'http://localhost:3100' },
    data: {
      service: 'starter',
      room: 'small',
      date: bookedDate,
      time: bookedTime,
      duration: 60,
      participants: 1,
      name: 'E2E Второй',
      phone: '+7 701 555 00 12',
      agreeTerms: true,
      locale: 'ru',
      idempotencyKey: randomUUID(),
    },
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toBe('SLOT_TAKEN');
});

test('9–10. owner confirms the booking; production tasks are created', async () => {
  await owner.goto(`/admin/bookings/${bookingId}`);
  await expect(owner.getByRole('heading', { name: new RegExp(bookingNumber) })).toBeVisible();
  await owner.getByRole('button', { name: '→ Подтверждён' }).click();
  await expect(owner.getByRole('heading', { level: 1 })).toContainText('Подтверждён');
  await expect(owner.getByRole('region', { name: 'Production-задачи' }).getByRole('listitem').first()).toBeVisible();
  expect(await db.productionTask.count({ where: { bookingId } })).toBeGreaterThan(0);
});

test('11–12. partial and full payment', async () => {
  await owner.locator('#pay-amount').fill('5000');
  await owner.getByRole('button', { name: 'Провести' }).click();
  await expect(owner.getByRole('status').filter({ hasText: 'Оплата проведена' }).first()).toBeVisible();
  await expect.poll(async () => (await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).paymentStatus).toBe('PARTIALLY_PAID');

  await expect(owner.locator('#pay-amount')).toHaveValue('15000');
  await owner.getByRole('button', { name: 'Провести' }).click();
  await expect(owner.getByRole('status').filter({ hasText: 'Оплата проведена' }).first()).toBeVisible();
  await expect.poll(async () => (await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).paymentStatus).toBe('PAID');
});

test('13–14. reschedule; Google Calendar update runs in dry-run', async () => {
  const newDate = addDays(todayInStudio(), 9);
  await owner.goto(`/admin/bookings/${bookingId}?rd=${newDate}`);
  await owner.locator('label:has(input[name="time"])').first().click();
  await owner.getByRole('button', { name: 'Перенести' }).click();
  await expect(owner.getByRole('status').filter({ hasText: /Заказ перенесён/ }).first()).toBeVisible();
  const moved = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  expect(moved.rescheduleCount).toBe(1);

  await expect
    .poll(async () => db.integrationJob.count({ where: { entityId: bookingId, type: 'booking.calendar_sync', status: 'COMPLETED' } }), {
      timeout: 20_000,
    })
    .toBeGreaterThanOrEqual(2);
  expect(await db.integrationJob.count({ where: { entityId: bookingId, status: 'FAILED' } })).toBe(0);
});

test('15–16. cancellation and refund', async () => {
  await owner.goto(`/admin/bookings/${bookingId}`);
  await owner.locator('#cancelReason').fill('E2E: клиент отменил');
  await owner.getByRole('button', { name: 'Отменить заказ' }).click();
  await expect(owner.getByRole('heading', { level: 1 })).toContainText('Отменён');

  await owner.getByText('Возврат клиенту').click();
  await owner.locator('#ref-note').fill('E2E возврат по правилам');
  await owner.getByRole('button', { name: 'Провести возврат' }).click();
  // Everything was refunded, so the refund form disappears; the ledger shows the entry.
  await expect(owner.getByText(/−20\s000/)).toBeVisible();
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  expect(booking.status).toBe('CANCELLED');
  expect(booking.paidAmount).toBe(20000 - (booking.refundAmount ?? 20000));
  expect(await db.payment.count({ where: { bookingId, kind: 'REFUND', status: 'PAID' } })).toBe(1);
  // Planned reminders were withdrawn, not left pending.
  expect(await db.integrationJob.count({ where: { entityId: bookingId, status: 'PENDING', type: { startsWith: 'booking.reminder' } } })).toBe(0);
  // Tasks of the cancelled booking left the production board.
  await owner.goto('/admin/production?view=list');
  await expect(owner.getByText(bookingNumber)).toHaveCount(0);
});

test('17. a failed integration job is retried from the CRM', async () => {
  const job = await db.integrationJob.create({
    data: {
      type: 'booking.sheets_sync',
      entityType: 'Booking',
      entityId: bookingId,
      payload: { entityId: bookingId },
      status: 'FAILED',
      attempts: 5,
      lastError: 'Error: Google Sheets responded with HTTP 503 (simulated)',
      idempotencyKey: `e2e-failed-${randomUUID()}`,
    },
  });
  await owner.goto('/admin/integrations');
  const row = owner.getByRole('row').filter({ hasText: 'simulated' });
  await row.getByRole('button', { name: 'Повторить' }).click();
  await expect(owner.getByRole('status').filter({ hasText: 'Повтор выполнен успешно' })).toBeVisible();
  expect((await db.integrationJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('COMPLETED');
});

test('18. dashboard shows the period figures', async () => {
  await owner.goto('/admin?period=month');
  for (const label of ['Выручка за период', 'Новые лиды за период', 'Просроченные задачи', 'Ошибки интеграций']) {
    await expect(owner.getByText(label).first()).toBeVisible();
  }
  // 20 000 paid − refund; the net figure is never negative.
  await expect(owner.getByText(/₸/).first()).toBeVisible();
});

test('19. layouts work on a phone and in Kazakh', async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await phone.newPage();
  for (const path of ['/', '/book', '/pricing', '/rooms', '/rooms/small', '/contacts', '/studio-tour', '/privacy', '/terms']) {
    await expectNoHorizontalScroll(page, path);
  }
  const narrow = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const small = await narrow.newPage();
  await expectNoHorizontalScroll(small, '/');
  await narrow.close();

  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'Открыть меню' });
  await menuButton.click();
  await expect(page.getByRole('button', { name: 'Закрыть меню' })).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#mobile-menu').getByRole('link', { name: 'Контакты' }).click();
  await expect(page).toHaveURL(/\/contacts/);
  await expect(page.locator('#mobile-menu')).toBeHidden();

  await page.getByRole('button', { name: 'ҚАЗ' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Байланыс');
  await page.goto('/rooms/small');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Кіші бөлме');

  await login(page, state.ownerEmail, state.ownerPassword);
  for (const path of ['/admin', '/admin/bookings', '/admin/calendar', '/admin/payments', '/admin/production']) {
    await expectNoHorizontalScroll(page, path);
  }
  await phone.close();
});

test('20. logout invalidates the session', async () => {
  const cookies = await owner.context().cookies();
  await owner.getByRole('button', { name: 'Выйти' }).click();
  await expect(owner).toHaveURL(/\/admin\/login/);
  // The old cookie no longer grants access (session deleted on the server).
  const replay = await owner.context().browser()!.newContext();
  await replay.addCookies(cookies);
  const page = await replay.newPage();
  await page.goto('/admin/bookings');
  await expect(page).toHaveURL(/\/admin\/login/);
  await replay.close();
});

test('public pages: 404 and SEO files', async ({ page, request }) => {
  expect((await request.get('/rooms/unknown')).status()).toBe(404);
  expect((await request.get('/no-such-page')).status()).toBe(404);
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain('/admin');
  expect((await request.get('/api/ready')).status()).toBe(200);
  const admin = await request.get('/admin/login');
  expect(admin.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(admin.headers()['cache-control']).toContain('no-store');
});
