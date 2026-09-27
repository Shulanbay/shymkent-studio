// Setting keys, schemas and defaults. Pure module (no DB access) so it can be
// used by the seed script and tests.

import { z } from 'zod';

export const SETTING_KEYS = {
  cancellationPolicy: 'cancellation_policy',
  workingHours: 'working_hours',
  googleIntegration: 'integration_google',
  studioContacts: 'studio_contacts',
  reminderRules: 'reminder_rules',
  integrationSwitches: 'integration_switches',
  productionTemplates: 'production_templates',
  crmOptions: 'crm_options',
} as const;

// ─── Working hours ────────────────────────────────────────────────────────────

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Формат ЧЧ:ММ');
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат ГГГГ-ММ-ДД');

export const dayHoursSchema = z
  .object({ open: timeString, close: timeString })
  .refine((h) => h.close > h.open, { message: 'Время закрытия должно быть позже открытия' });
export type DayHours = z.infer<typeof dayHoursSchema>;

export const WEEKDAY_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const;

export const workingHoursSchema = z.object({
  timeZone: z.literal('Asia/Almaty'),
  /** Keys 1..7 = Monday..Sunday (ISO). null = day off. */
  days: z.record(z.enum(WEEKDAY_KEYS), dayHoursSchema.nullable()),
  /** Date-specific overrides (holidays, short days). null = closed that day. */
  exceptions: z.record(dateString, dayHoursSchema.nullable()).default({}),
  slotStepMinutes: z.number().int().min(5).max(120),
  /** Earliest booking relative to now. */
  minLeadMinutes: z.number().int().min(0).max(7 * 24 * 60),
  /** How far ahead the public form allows booking. */
  maxAdvanceDays: z.number().int().min(1).max(365),
  /** Studio tours: one host, so tours never overlap each other. */
  tour: z
    .object({
      durationMinutes: z.number().int().min(5).max(120),
      slotStepMinutes: z.number().int().min(5).max(120),
    })
    .default({ durationMinutes: 15, slotStepMinutes: 30 }),
});
export type WorkingHours = z.infer<typeof workingHoursSchema>;

// Business hours are not published anywhere yet — these are placeholders the
// owner can change in the CRM.
export const DEFAULT_WORKING_HOURS: WorkingHours = {
  timeZone: 'Asia/Almaty',
  days: {
    '1': { open: '10:00', close: '22:00' },
    '2': { open: '10:00', close: '22:00' },
    '3': { open: '10:00', close: '22:00' },
    '4': { open: '10:00', close: '22:00' },
    '5': { open: '10:00', close: '22:00' },
    '6': { open: '10:00', close: '22:00' },
    '7': { open: '10:00', close: '22:00' },
  },
  exceptions: {},
  slotStepMinutes: 30,
  minLeadMinutes: 120,
  maxAdvanceDays: 90,
  tour: { durationMinutes: 15, slotStepMinutes: 30 },
};

// ─── Studio contacts (used in emails, forms, structured data) ────────────────

const optionalHttpsUrl = z
  .union([z.literal(''), z.url({ protocol: /^https$/, message: 'Ссылка должна начинаться с https://' }).max(500)])
  .default('');

export const studioContactsSchema = z.object({
  /** Shown in emails, the footer and structured data. */
  studioName: z.string().trim().min(2).max(80).default('SHYMKENT STUDIO'),
  email: z.email('Некорректный email').max(254),
  phone: z.string().trim().min(5).max(32),
  whatsapp: z.string().trim().regex(/^\d{10,15}$/, 'WhatsApp: только цифры с кодом страны, например 77005030501'),
  instagram: z.string().trim().regex(/^[A-Za-z0-9._]{0,30}$/, 'Instagram: только имя аккаунта, без @ и ссылки'),
  city: z.string().trim().max(100),
  /** Street address in Russian (also used when no Kazakh version is set). */
  address: z.string().trim().max(200),
  addressKk: z.string().trim().max(200).default(''),
  /** Link to 2GIS / Google Maps / Yandex Maps. Empty = no map link on the site. */
  mapUrl: optionalHttpsUrl,
  /** Planned opening date (YYYY-MM-DD). The site shows a notice only while it is in the future. */
  openingDate: z.union([z.literal(''), dateString]).default(''),
});
export type StudioContacts = z.infer<typeof studioContactsSchema>;

// Current public contacts of the studio (previously hard-coded in the site).
export const DEFAULT_STUDIO_CONTACTS: StudioContacts = {
  studioName: 'SHYMKENT STUDIO',
  email: 'salem@shymkent.studio',
  phone: '+7 700 503 05 01',
  whatsapp: '77005030501',
  instagram: 'shymkent.studio',
  city: 'Шымкент',
  // Full address confirmed by the owner (2026-09).
  address: 'Каратауский район, ул. Сейдоллы Байтерекова, 85, кв. 28, ЖК «Байтерек»',
  addressKk: 'Қаратау ауданы, Сейдолла Байтереков көшесі, 85, 28-пәтер, «Бәйтерек» тұрғын үй кешені',
  mapUrl: 'https://maps.google.com/?q=Shymkent,+Seidolla+Bayterek+Street,+85',
  // As published on /contacts: «Студия откроется 10 ноября 2026 года».
  openingDate: '2026-11-10',
};

// ─── Reminders ────────────────────────────────────────────────────────────────

export const reminderRulesSchema = z.object({
  booking24h: z.boolean(),
  booking2h: z.boolean(),
  tourHoursBefore: z.number().int().min(0).max(72),
});
export type ReminderRules = z.infer<typeof reminderRulesSchema>;
export const DEFAULT_REMINDER_RULES: ReminderRules = { booking24h: true, booking2h: true, tourHoursBefore: 24 };

// ─── Integration switches (on top of env configuration) ──────────────────────

export const integrationSwitchesSchema = z.object({
  email: z.boolean(),
  calendar: z.boolean(),
  sheets: z.boolean(),
});
export type IntegrationSwitches = z.infer<typeof integrationSwitchesSchema>;
export const DEFAULT_INTEGRATION_SWITCHES: IntegrationSwitches = { email: true, calendar: true, sheets: true };

// ─── Production task templates per tariff ────────────────────────────────────

export const PRODUCTION_TYPES = ['PREPARATION', 'RECORDING', 'EDITING', 'THUMBNAIL', 'SHORTS', 'REVIEW', 'DELIVERY', 'PUBLISHING'] as const;

export const taskTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  type: z.enum(PRODUCTION_TYPES),
  title: z.string().trim().min(2).max(120),
  /** Due date relative to the end of the recording, in hours (negative = before the session starts). */
  dueOffsetHours: z.number().int().min(-24 * 14).max(24 * 60),
  /** Relative to the session start instead of its end. */
  relativeToStart: z.boolean().default(false),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  checklist: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
});
export type TaskTemplate = z.infer<typeof taskTemplateSchema>;

export const productionTemplatesSchema = z.record(z.string().regex(/^[a-z0-9-]{1,32}$/), z.array(taskTemplateSchema).max(20));
export type ProductionTemplates = z.infer<typeof productionTemplatesSchema>;

const prep: TaskTemplate = {
  key: 'prep',
  type: 'PREPARATION',
  title: 'Подготовка студии и связь с клиентом',
  dueOffsetHours: -24,
  relativeToStart: true,
  priority: 'NORMAL',
  checklist: ['Подтвердить время с клиентом', 'Проверить свет и микрофоны', 'Подготовить карты памяти'],
};
const recording: TaskTemplate = {
  key: 'recording',
  type: 'RECORDING',
  title: 'Запись',
  dueOffsetHours: 0,
  relativeToStart: false,
  priority: 'HIGH',
  checklist: ['Записать звук с резервом', 'Проверить синхронизацию камер', 'Сделать резервную копию исходников'],
};
const editing: TaskTemplate = { key: 'editing', type: 'EDITING', title: 'Монтаж эпизода', dueOffsetHours: 72, relativeToStart: false, priority: 'NORMAL', checklist: ['Multicam монтаж', 'Звук и цвет', 'Intro/outro и графика'] };
const review: TaskTemplate = { key: 'review', type: 'REVIEW', title: 'Проверка перед отправкой', dueOffsetHours: 96, relativeToStart: false, priority: 'NORMAL', checklist: [] };

// Deadlines follow the published terms: sources in 24 h, edited episode in 3–5 working days.
export const DEFAULT_PRODUCTION_TEMPLATES: ProductionTemplates = {
  starter: [
    prep,
    recording,
    { key: 'delivery', type: 'DELIVERY', title: 'Передать исходники клиенту', dueOffsetHours: 24, relativeToStart: false, priority: 'HIGH', checklist: ['Загрузить исходники в облако', 'Отправить ссылку клиенту'] },
  ],
  pro: [
    prep,
    recording,
    editing,
    review,
    { key: 'delivery', type: 'DELIVERY', title: 'Передать готовый эпизод', dueOffsetHours: 120, relativeToStart: false, priority: 'HIGH', checklist: ['Загрузить финальный файл', 'Отправить ссылку клиенту'] },
  ],
  premium: [
    prep,
    recording,
    editing,
    { key: 'thumbnail', type: 'THUMBNAIL', title: 'YouTube thumbnail', dueOffsetHours: 72, relativeToStart: false, priority: 'NORMAL', checklist: [] },
    { key: 'shorts', type: 'SHORTS', title: '3 вертикальных Reels / Shorts', dueOffsetHours: 96, relativeToStart: false, priority: 'NORMAL', checklist: ['Reels 1', 'Reels 2', 'Reels 3'] },
    review,
    { key: 'delivery', type: 'DELIVERY', title: 'Передать выпуск, Reels и обложку', dueOffsetHours: 120, relativeToStart: false, priority: 'HIGH', checklist: ['Загрузить материалы', 'Отправить ссылку клиенту'] },
    { key: 'publishing', type: 'PUBLISHING', title: 'Подготовка выпуска к публикации на YouTube', dueOffsetHours: 120, relativeToStart: false, priority: 'NORMAL', checklist: ['Название и описание', 'Тайм-коды'] },
  ],
};

// ─── CRM behaviour ────────────────────────────────────────────────────────────

export const crmOptionsSchema = z.object({
  /** Create a lead for every new public booking request (tours always create one). */
  autoLeadFromBooking: z.boolean(),
});
export type CrmOptions = z.infer<typeof crmOptionsSchema>;
export const DEFAULT_CRM_OPTIONS: CrmOptions = { autoLeadFromBooking: false };
