import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { IntegrationConfig } from '@/lib/integrations/config';
import type { ReminderRules } from '@/lib/settings-schema';

type Db = PrismaClient | Prisma.TransactionClient;

export const JOB_TYPES = [
  'booking.admin_email',
  'booking.client_email',
  'booking.confirmed_email',
  'booking.payment_link_email',
  'booking.rescheduled_email',
  'booking.cancelled_email',
  'booking.reminder_24h',
  'booking.reminder_2h',
  'booking.ready_email',
  'booking.calendar_sync',
  'booking.sheets_sync',
  'tour.admin_email',
  'tour.confirmed_email',
  'tour.rescheduled_email',
  'tour.cancelled_email',
  'tour.reminder',
  'tour.calendar_sync',
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const EMAIL_JOB_TYPES: ReadonlySet<string> = new Set(JOB_TYPES.filter((t) => t.includes('email') || t.includes('reminder')));

export const JOB_LABELS: Record<JobType, string> = {
  'booking.admin_email': 'Письмо администратору о заявке',
  'booking.client_email': 'Клиенту: заявка получена',
  'booking.confirmed_email': 'Клиенту: бронирование подтверждено',
  'booking.payment_link_email': 'Клиенту: ссылка на оплату',
  'booking.rescheduled_email': 'Клиенту: бронирование перенесено',
  'booking.cancelled_email': 'Клиенту: бронирование отменено',
  'booking.reminder_24h': 'Клиенту: напоминание за 24 часа',
  'booking.reminder_2h': 'Клиенту: напоминание за 2 часа',
  'booking.ready_email': 'Клиенту: заказ готов',
  'booking.calendar_sync': 'Google Calendar: заказ',
  'booking.sheets_sync': 'Google Sheets: строка заказа',
  'tour.admin_email': 'Письмо администратору о туре',
  'tour.confirmed_email': 'Клиенту: тур подтверждён',
  'tour.rescheduled_email': 'Клиенту: тур перенесён',
  'tour.cancelled_email': 'Клиенту: тур отменён',
  'tour.reminder': 'Клиенту: напоминание о туре',
  'tour.calendar_sync': 'Google Calendar: тур',
};

export interface JobSpec {
  type: JobType;
  entityType: 'Booking' | 'TourRequest';
  entityId: string;
  /** Stable key: the same business event never produces a second job. */
  idempotencyKey: string;
  /** Extra data the handler checks (e.g. the start time a reminder was planned for). */
  payload?: Record<string, string | number | boolean>;
  /** Earliest time to run (reminders). */
  runAt?: Date;
}

/** Inserts jobs; a repeated idempotencyKey is ignored. Call inside the business transaction. */
export async function enqueueJobs(db: Db, jobs: JobSpec[]): Promise<string[]> {
  if (jobs.length === 0) return [];
  const created = await db.integrationJob.createManyAndReturn({
    data: jobs.map((j) => ({
      type: j.type,
      entityType: j.entityType,
      entityId: j.entityId,
      idempotencyKey: j.idempotencyKey,
      payload: { entityId: j.entityId, ...(j.payload ?? {}) },
      ...(j.runAt ? { nextAttemptAt: j.runAt } : {}),
    })),
    skipDuplicates: true,
    select: { id: true },
  });
  return created.map((j) => j.id);
}

const shortHash = (value: string) => createHash('sha1').update(value).digest('hex').slice(0, 16);

interface Ctx {
  config: IntegrationConfig;
  hasClientEmail: boolean;
}

const booking = (id: string) => ({ entityType: 'Booking' as const, entityId: id });
const tour = (id: string) => ({ entityType: 'TourRequest' as const, entityId: id });

function calendarBooking(id: string, version: string, config: IntegrationConfig): JobSpec[] {
  return config.calendar ? [{ ...booking(id), type: 'booking.calendar_sync', idempotencyKey: `booking:${id}:calendar_sync:${version}` }] : [];
}
function sheetsBooking(id: string, version: string, config: IntegrationConfig): JobSpec[] {
  return config.sheets ? [{ ...booking(id), type: 'booking.sheets_sync', idempotencyKey: `booking:${id}:sheets_sync:${version}` }] : [];
}
function calendarTour(id: string, version: string, config: IntegrationConfig): JobSpec[] {
  return config.calendar ? [{ ...tour(id), type: 'tour.calendar_sync', idempotencyKey: `tour:${id}:calendar_sync:${version}` }] : [];
}

export function bookingCreatedJobs(bookingId: string, hasClientEmail: boolean, config: IntegrationConfig): JobSpec[] {
  const jobs: JobSpec[] = [];
  if (config.email && config.adminEmail) jobs.push({ ...booking(bookingId), type: 'booking.admin_email', idempotencyKey: `booking:${bookingId}:admin_email` });
  if (config.email && hasClientEmail) jobs.push({ ...booking(bookingId), type: 'booking.client_email', idempotencyKey: `booking:${bookingId}:client_email` });
  return [...jobs, ...calendarBooking(bookingId, 'created', config), ...sheetsBooking(bookingId, 'created', config)];
}

/** Calendar / Sheets refresh after any change (status, notes, amounts). */
export function bookingChangedJobs(bookingId: string, version: string, config: IntegrationConfig): JobSpec[] {
  return [...calendarBooking(bookingId, version, config), ...sheetsBooking(bookingId, version, config)];
}

function reminderJobs(bookingId: string, startAt: Date, now: Date, ctx: Ctx, rules: ReminderRules): JobSpec[] {
  if (!ctx.config.email || !ctx.hasClientEmail) return [];
  const start = startAt.toISOString();
  const plan: [JobType, number, boolean][] = [
    ['booking.reminder_24h', 24, rules.booking24h],
    ['booking.reminder_2h', 2, rules.booking2h],
  ];
  return plan
    .filter(([, hours, enabled]) => enabled && startAt.getTime() - hours * 3600_000 > now.getTime())
    .map(([type, hours]) => ({
      ...booking(bookingId),
      type,
      idempotencyKey: `booking:${bookingId}:${type.split('.')[1]}:${start}`,
      payload: { startAt: start },
      runAt: new Date(startAt.getTime() - hours * 3600_000),
    }));
}

export function bookingConfirmedJobs(bookingId: string, startAt: Date, now: Date, ctx: Ctx, rules: ReminderRules): JobSpec[] {
  const email: JobSpec[] =
    ctx.config.email && ctx.hasClientEmail
      ? [{ ...booking(bookingId), type: 'booking.confirmed_email', idempotencyKey: `booking:${bookingId}:confirmed_email` }]
      : [];
  return [...email, ...reminderJobs(bookingId, startAt, now, ctx, rules), ...bookingChangedJobs(bookingId, `confirmed:${now.getTime()}`, ctx.config)];
}

export function bookingRescheduledJobs(
  bookingId: string,
  startAt: Date,
  confirmed: boolean,
  now: Date,
  ctx: Ctx,
  rules: ReminderRules,
): JobSpec[] {
  const start = startAt.toISOString();
  const email: JobSpec[] =
    ctx.config.email && ctx.hasClientEmail
      ? [{ ...booking(bookingId), type: 'booking.rescheduled_email', idempotencyKey: `booking:${bookingId}:rescheduled:${start}`, payload: { startAt: start } }]
      : [];
  return [
    ...email,
    ...(confirmed ? reminderJobs(bookingId, startAt, now, ctx, rules) : []),
    ...bookingChangedJobs(bookingId, `rescheduled:${start}`, ctx.config),
  ];
}

export function bookingCancelledJobs(bookingId: string, ctx: Ctx): JobSpec[] {
  const email: JobSpec[] =
    ctx.config.email && ctx.hasClientEmail
      ? [{ ...booking(bookingId), type: 'booking.cancelled_email', idempotencyKey: `booking:${bookingId}:cancelled_email` }]
      : [];
  return [...email, ...bookingChangedJobs(bookingId, 'cancelled', ctx.config)];
}

export function paymentLinkJobs(bookingId: string, url: string, ctx: Ctx): JobSpec[] {
  return ctx.config.email && ctx.hasClientEmail
    ? [{ ...booking(bookingId), type: 'booking.payment_link_email', idempotencyKey: `booking:${bookingId}:payment_link:${shortHash(url)}`, payload: { url } }]
    : [];
}

export function bookingReadyJobs(bookingId: string, ctx: Ctx): JobSpec[] {
  return ctx.config.email && ctx.hasClientEmail
    ? [{ ...booking(bookingId), type: 'booking.ready_email', idempotencyKey: `booking:${bookingId}:ready_email` }]
    : [];
}

export function tourCreatedJobs(tourId: string, config: IntegrationConfig): JobSpec[] {
  const jobs: JobSpec[] = [];
  if (config.email && config.adminEmail) jobs.push({ ...tour(tourId), type: 'tour.admin_email', idempotencyKey: `tour:${tourId}:admin_email` });
  return [...jobs, ...calendarTour(tourId, 'created', config)];
}

export function tourChangedJobs(tourId: string, version: string, config: IntegrationConfig): JobSpec[] {
  return calendarTour(tourId, version, config);
}

function tourReminder(tourId: string, startAt: Date, now: Date, ctx: Ctx, rules: ReminderRules): JobSpec[] {
  if (!ctx.config.email || !ctx.hasClientEmail || rules.tourHoursBefore <= 0) return [];
  const runAt = new Date(startAt.getTime() - rules.tourHoursBefore * 3600_000);
  if (runAt <= now) return [];
  const start = startAt.toISOString();
  return [{ ...tour(tourId), type: 'tour.reminder', idempotencyKey: `tour:${tourId}:reminder:${start}`, payload: { startAt: start }, runAt }];
}

export function tourConfirmedJobs(tourId: string, startAt: Date, now: Date, ctx: Ctx, rules: ReminderRules): JobSpec[] {
  const email: JobSpec[] =
    ctx.config.email && ctx.hasClientEmail ? [{ ...tour(tourId), type: 'tour.confirmed_email', idempotencyKey: `tour:${tourId}:confirmed_email` }] : [];
  return [...email, ...tourReminder(tourId, startAt, now, ctx, rules), ...calendarTour(tourId, `confirmed:${now.getTime()}`, ctx.config)];
}

export function tourRescheduledJobs(tourId: string, startAt: Date, confirmed: boolean, now: Date, ctx: Ctx, rules: ReminderRules): JobSpec[] {
  const start = startAt.toISOString();
  const email: JobSpec[] =
    ctx.config.email && ctx.hasClientEmail
      ? [{ ...tour(tourId), type: 'tour.rescheduled_email', idempotencyKey: `tour:${tourId}:rescheduled:${start}`, payload: { startAt: start } }]
      : [];
  return [...email, ...(confirmed ? tourReminder(tourId, startAt, now, ctx, rules) : []), ...calendarTour(tourId, `rescheduled:${start}`, ctx.config)];
}

export function tourCancelledJobs(tourId: string, ctx: Ctx): JobSpec[] {
  const email: JobSpec[] =
    ctx.config.email && ctx.hasClientEmail ? [{ ...tour(tourId), type: 'tour.cancelled_email', idempotencyKey: `tour:${tourId}:cancelled_email` }] : [];
  return [...email, ...calendarTour(tourId, 'cancelled', ctx.config)];
}

const REMINDER_TYPES: Record<'Booking' | 'TourRequest', JobType[]> = {
  Booking: ['booking.reminder_24h', 'booking.reminder_2h'],
  TourRequest: ['tour.reminder'],
};

/**
 * Marks planned reminders that no longer apply as done-without-sending
 * (booking cancelled, or moved: `keepStartAt` = the new start). Handlers would
 * skip them anyway; this keeps the CRM queue honest. Call inside the business transaction.
 */
export async function skipObsoleteReminders(
  db: Db,
  entityType: 'Booking' | 'TourRequest',
  entityId: string,
  reason: 'cancelled' | 'rescheduled',
  keepStartAt?: Date,
): Promise<number> {
  const keep = keepStartAt ? keepStartAt.toISOString() : null;
  return db.$executeRaw`
    UPDATE "IntegrationJob"
    SET "status" = 'COMPLETED', "completedAt" = now(), "lockedAt" = NULL, "providerRef" = ${`skipped: ${reason}`}, "updatedAt" = now()
    WHERE "entityType" = ${entityType} AND "entityId" = ${entityId} AND "status" = 'PENDING'
      AND "type" = ANY(${REMINDER_TYPES[entityType]}::text[])
      AND (${keep}::text IS NULL OR "payload"->>'startAt' IS DISTINCT FROM ${keep}::text)`;
}

/** Status shown in the CRM: a reminder skipped because it no longer applies is not "sent". */
export function jobStatusText(job: { status: string; providerRef: string | null }): string {
  if (job.status === 'COMPLETED' && job.providerRef?.startsWith('skipped:')) {
    return job.providerRef.includes('cancelled') ? 'не отправлено (отмена)' : 'не отправлено (перенос)';
  }
  return job.status;
}
