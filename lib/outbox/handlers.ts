import 'server-only';
import { createHash } from 'node:crypto';
import type { IntegrationJob, PrismaClient } from '@prisma/client';
import { getSiteUrl } from '@/lib/env';
import { getIntegrationConfig } from '@/lib/integrations/config';
import {
  bookingAdminEmail,
  clientEmail,
  tourAdminEmail,
  type BookingEmailData,
  type ClientEmailKind,
  type Lang,
} from '@/lib/notifications/templates';
import { formatKzPhone } from '@/lib/phone';
import { policyTexts } from '@/lib/policy';
import { formatBookingNumber, formatTourNumber } from '@/lib/public/schemas';
import { getCancellationPolicy, getStudioContacts } from '@/lib/settings';
import { utcToZoned } from '@/lib/time';
import type { JobType } from './jobs';
import type { Transports } from './transports';

/**
 * A handler performs one side effect. It returns the provider reference
 * (e.g. SMTP Message-ID) when there is one. Handlers re-check the current
 * state first: a reminder for a booking that was moved or cancelled, or a
 * "confirmed" email for a booking that is no longer confirmed, is skipped.
 */
export type JobHandler = (db: PrismaClient, job: IntegrationJob, transports: Transports) => Promise<string | null | void>;

/** Google Calendar event ids must be base32hex (a–v, 0–9); a hash of our id is stable and valid. */
export function calendarEventId(kind: 'b' | 't', entityId: string): string {
  return `ss${kind}${createHash('sha1').update(entityId).digest('hex')}`;
}

const localDate = (d: Date) => {
  const [y, m, day] = utcToZoned(d).date.split('-');
  return `${day}.${m}.${y}`;
};
const localTime = (d: Date) => utcToZoned(d).time;
const payloadOf = (job: IntegrationJob) => (job.payload ?? {}) as Record<string, unknown>;
const sameStart = (job: IntegrationJob, start: Date) => payloadOf(job).startAt === start.toISOString();

async function loadBooking(db: PrismaClient, id: string) {
  return db.booking.findUnique({ where: { id }, include: { client: true, room: true, service: true } });
}
type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

function bookingEmailData(b: LoadedBooking, lang: Lang): BookingEmailData {
  return {
    number: formatBookingNumber(b.bookingNumber),
    serviceName: lang === 'kk' ? b.service.nameKk : b.service.nameRu,
    roomName: lang === 'kk' ? b.room.nameKk : b.room.nameRu,
    date: localDate(b.startAt),
    time: `${localTime(b.startAt)}–${localTime(b.endAt)}`,
    durationMinutes: Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60_000),
    participants: b.participants,
    total: b.totalAmount,
    clientName: b.client.name,
    clientPhone: formatKzPhone(b.client.normalizedPhone),
    clientEmail: b.client.email,
    comment: b.comment,
    crmUrl: `${getSiteUrl()}/admin/bookings/${b.id}`,
  };
}

function requireAdminEmail(): string {
  const to = getIntegrationConfig().adminEmail;
  if (!to) throw new Error('Admin notification email is not configured');
  return to;
}

/** Sends a lifecycle email about a booking to its client, in the client's language. */
async function sendBookingEmail(
  db: PrismaClient,
  t: Transports,
  b: LoadedBooking,
  kind: ClientEmailKind,
  extra: { linkUrl?: string | null; withPolicy?: boolean } = {},
): Promise<string | null | void> {
  if (!b.client.email) return;
  const lang: Lang = b.locale === 'KK' ? 'kk' : 'ru';
  const d = bookingEmailData(b, lang);
  const email = clientEmail(kind, lang, {
    number: d.number,
    clientName: b.client.name,
    date: d.date,
    time: d.time,
    serviceName: d.serviceName,
    roomName: d.roomName,
    total: b.totalAmount,
    refundAmount: b.refundAmount,
    linkUrl: extra.linkUrl,
    policy: extra.withPolicy ? policyTexts(await getCancellationPolicy(db), lang) : undefined,
    contacts: await getStudioContacts(db),
  });
  return t.sendEmail({ to: b.client.email, ...email });
}

async function loadTour(db: PrismaClient, id: string) {
  return db.tourRequest.findUnique({ where: { id }, include: { client: true } });
}
type LoadedTour = NonNullable<Awaited<ReturnType<typeof loadTour>>>;

async function sendTourEmail(db: PrismaClient, t: Transports, tour: LoadedTour, kind: ClientEmailKind) {
  if (!tour.client.email) return;
  const lang: Lang = tour.locale === 'KK' ? 'kk' : 'ru';
  const email = clientEmail(kind, lang, {
    number: formatTourNumber(tour.requestNumber),
    clientName: tour.client.name,
    date: localDate(tour.scheduledAt),
    time: `${localTime(tour.scheduledAt)}–${localTime(tour.scheduledEnd)}`,
    contacts: await getStudioContacts(db),
  });
  return t.sendEmail({ to: tour.client.email, ...email });
}

const handlers: Record<JobType, JobHandler> = {
  async 'booking.admin_email'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    if (!b) return;
    return t.sendEmail({ to: requireAdminEmail(), ...bookingAdminEmail(bookingEmailData(b, 'ru')) });
  },

  async 'booking.client_email'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    if (!b) return;
    return sendBookingEmail(db, t, b, 'received', { withPolicy: true });
  },

  async 'booking.confirmed_email'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    if (!b || b.status !== 'CONFIRMED') return;
    return sendBookingEmail(db, t, b, 'confirmed', { withPolicy: true });
  },

  async 'booking.payment_link_email'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    const url = payloadOf(job).url;
    if (!b || b.status === 'CANCELLED' || typeof url !== 'string') return;
    return sendBookingEmail(db, t, b, 'payment_link', { linkUrl: url });
  },

  async 'booking.rescheduled_email'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    // Skip if a later reschedule superseded this one or the booking was cancelled.
    if (!b || b.status === 'CANCELLED' || !sameStart(job, b.startAt)) return;
    return sendBookingEmail(db, t, b, 'rescheduled');
  },

  async 'booking.cancelled_email'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    if (!b || b.status !== 'CANCELLED') return;
    return sendBookingEmail(db, t, b, 'cancelled');
  },

  async 'booking.reminder_24h'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    if (!b || b.status !== 'CONFIRMED' || !sameStart(job, b.startAt) || b.startAt <= new Date()) return;
    return sendBookingEmail(db, t, b, 'reminder_24h');
  },

  async 'booking.reminder_2h'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    if (!b || b.status !== 'CONFIRMED' || !sameStart(job, b.startAt) || b.startAt <= new Date()) return;
    return sendBookingEmail(db, t, b, 'reminder_2h');
  },

  async 'booking.ready_email'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    if (!b || b.status === 'CANCELLED') return;
    return sendBookingEmail(db, t, b, 'ready', { linkUrl: b.materialsUrl });
  },

  async 'booking.calendar_sync'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    if (!b) return;
    const eventId = calendarEventId('b', b.id);
    if (b.status === 'CANCELLED') {
      await t.calendarDelete(eventId);
      if (b.googleCalendarEventId) await db.booking.update({ where: { id: b.id }, data: { googleCalendarEventId: null } });
      return eventId;
    }
    const d = bookingEmailData(b, 'ru');
    await t.calendarUpsert(eventId, {
      summary: `${d.number} · ${b.service.nameRu} · ${b.client.name}`,
      description: `Комната: ${d.roomName}\nКлиент: ${b.client.name}\nТелефон: ${d.clientPhone}\nУчастников: ${b.participants}\nСтатус: ${b.status}\nCRM: ${d.crmUrl}`,
      start: b.startAt,
      end: b.endAt,
      colorId: b.room.googleColorId,
    });
    if (b.googleCalendarEventId !== eventId) await db.booking.update({ where: { id: b.id }, data: { googleCalendarEventId: eventId } });
    return eventId;
  },

  async 'booking.sheets_sync'(db, job, t) {
    const b = await loadBooking(db, job.entityId);
    if (!b) return;
    const d = bookingEmailData(b, 'ru');
    await t.sheetsUpsert(d.number, {
      bookingNumber: d.number,
      status: b.status,
      paymentStatus: b.paymentStatus,
      name: b.client.name,
      phone: d.clientPhone,
      email: b.client.email ?? '',
      service: b.service.nameRu,
      room: b.room.nameRu,
      date: utcToZoned(b.startAt).date,
      time: localTime(b.startAt),
      duration: d.durationMinutes,
      participants: b.participants,
      comment: b.comment ?? '',
      price: b.totalAmount,
      paid: b.paidAmount,
      timestamp: b.createdAt.toISOString(),
    });
    return d.number;
  },

  async 'tour.admin_email'(db, job, t) {
    const tour = await loadTour(db, job.entityId);
    if (!tour) return;
    return t.sendEmail({
      to: requireAdminEmail(),
      ...tourAdminEmail({
        number: formatTourNumber(tour.requestNumber),
        date: localDate(tour.scheduledAt),
        time: `${localTime(tour.scheduledAt)}–${localTime(tour.scheduledEnd)}`,
        format: tour.format,
        clientName: tour.client.name,
        clientPhone: formatKzPhone(tour.client.normalizedPhone),
        crmUrl: `${getSiteUrl()}/admin/tours/${tour.id}`,
      }),
    });
  },

  async 'tour.confirmed_email'(db, job, t) {
    const tour = await loadTour(db, job.entityId);
    if (!tour || tour.status !== 'CONFIRMED') return;
    return sendTourEmail(db, t, tour, 'tour_confirmed');
  },

  async 'tour.rescheduled_email'(db, job, t) {
    const tour = await loadTour(db, job.entityId);
    if (!tour || tour.status === 'CANCELLED' || !sameStart(job, tour.scheduledAt)) return;
    return sendTourEmail(db, t, tour, 'tour_rescheduled');
  },

  async 'tour.cancelled_email'(db, job, t) {
    const tour = await loadTour(db, job.entityId);
    if (!tour || tour.status !== 'CANCELLED') return;
    return sendTourEmail(db, t, tour, 'tour_cancelled');
  },

  async 'tour.reminder'(db, job, t) {
    const tour = await loadTour(db, job.entityId);
    if (!tour || tour.status !== 'CONFIRMED' || !sameStart(job, tour.scheduledAt) || tour.scheduledAt <= new Date()) return;
    return sendTourEmail(db, t, tour, 'tour_reminder');
  },

  async 'tour.calendar_sync'(db, job, t) {
    const tour = await loadTour(db, job.entityId);
    if (!tour) return;
    const eventId = calendarEventId('t', tour.id);
    if (tour.status === 'CANCELLED') {
      await t.calendarDelete(eventId);
      if (tour.googleCalendarEventId) await db.tourRequest.update({ where: { id: tour.id }, data: { googleCalendarEventId: null } });
      return eventId;
    }
    await t.calendarUpsert(eventId, {
      summary: `Тур ${formatTourNumber(tour.requestNumber)} · ${tour.client.name}`,
      description: `Клиент: ${tour.client.name}\nТелефон: ${formatKzPhone(tour.client.normalizedPhone)}\nСтатус: ${tour.status}\nCRM: ${getSiteUrl()}/admin/tours/${tour.id}`,
      start: tour.scheduledAt,
      end: tour.scheduledEnd,
    });
    if (tour.googleCalendarEventId !== eventId) await db.tourRequest.update({ where: { id: tour.id }, data: { googleCalendarEventId: eventId } });
    return eventId;
  },
};

// Jobs enqueued before the Sheets handler became an upsert.
const LEGACY_ALIASES: Record<string, JobType> = { 'booking.sheets_append': 'booking.sheets_sync' };

export function getHandler(type: string): JobHandler | undefined {
  return (handlers as Record<string, JobHandler>)[LEGACY_ALIASES[type] ?? type];
}
