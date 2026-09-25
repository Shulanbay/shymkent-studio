import 'server-only';
import type { Booking, PrismaClient } from '@prisma/client';
import { logActivity } from '@/lib/activity';
import { checkSlot } from '@/lib/availability';
import type { IntegrationConfig } from '@/lib/integrations/config';
import { getEffectiveIntegrationConfig } from '@/lib/integrations/effective';
import { bookingCreatedJobs, enqueueJobs } from '@/lib/outbox/jobs';
import { formatKzPhone, normalizeKzPhone } from '@/lib/phone';
import { computeBookingPrice, durationOptions } from '@/lib/pricing';
import { TERMS_VERSION, formatBookingNumber, type PublicBookingInput } from '@/lib/public/schemas';
import { normalizeServiceSlug } from '@/lib/services';
import { getCrmOptions, getWorkingHours } from '@/lib/settings';
import { ensureLeadForBooking } from '@/lib/admin/leads';
import { PublicRequestError, isExclusionViolation, isUniqueViolation, loadRoomBusy, upsertClientByPhone } from './shared';

export interface CreatedBooking {
  booking: Booking;
  bookingNumber: string;
  /** false when the idempotency key matched an earlier submission. */
  created: boolean;
  jobIds: string[];
}

/**
 * Creates a public booking request. Order of operations:
 *   validate → load catalog → price → check slot → one transaction
 *   (client upsert, booking insert, activity log, outbox jobs) → commit.
 * The PostgreSQL exclusion constraint is the final guard against races.
 */
export async function createPublicBooking(
  db: PrismaClient,
  input: PublicBookingInput,
  opts: { now?: Date; config?: IntegrationConfig; source?: string } = {},
): Promise<CreatedBooking> {
  const now = opts.now ?? new Date();

  const existing = await db.booking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { booking: existing, bookingNumber: formatBookingNumber(existing.bookingNumber), created: false, jobIds: [] };

  const serviceSlug = normalizeServiceSlug(input.service);
  const service = serviceSlug ? await db.service.findUnique({ where: { slug: serviceSlug } }) : null;
  if (!service?.active) throw new PublicRequestError('SERVICE_UNAVAILABLE');
  const room = await db.room.findUnique({ where: { slug: input.room } });
  if (!room?.active) throw new PublicRequestError('ROOM_UNAVAILABLE');
  if (input.participants > room.capacity) throw new PublicRequestError('CAPACITY');

  // Only the durations offered by the tariff; the price is computed here, never taken from the client.
  if (!durationOptions(service).includes(input.duration)) throw new PublicRequestError('INVALID_DURATION');
  const price = computeBookingPrice(service, input.duration);
  if (!price.ok) throw new PublicRequestError('INVALID_DURATION');

  const normalizedPhone = normalizeKzPhone(input.phone);
  if (!normalizedPhone) throw new PublicRequestError('INVALID_PHONE');

  const hours = await getWorkingHours(db);
  const slot = checkSlot({
    date: input.date,
    time: input.time,
    durationMinutes: input.duration,
    bufferBeforeMinutes: room.bufferBeforeMinutes,
    bufferAfterMinutes: room.bufferAfterMinutes,
    stepMinutes: hours.slotStepMinutes,
    busy: await loadRoomBusy(db, room.id, input.date),
    hours,
    now,
  });
  if (!slot.ok) throw new PublicRequestError(slot.reason === 'CONFLICT' ? 'SLOT_TAKEN' : slot.reason);

  const config = opts.config ?? (await getEffectiveIntegrationConfig(db));
  const locale = input.locale === 'kk' ? 'KK' : 'RU';
  const autoLead = (await getCrmOptions(db)).autoLeadFromBooking;
  try {
    const { booking, jobIds } = await db.$transaction(async (tx) => {
      const client = await upsertClientByPhone(tx, {
        name: input.name,
        normalizedPhone,
        phone: formatKzPhone(normalizedPhone),
        email: input.email,
        locale,
        source: opts.source ?? 'website',
      });
      const booking = await tx.booking.create({
        data: {
          clientId: client.id,
          roomId: room.id,
          serviceId: service.id,
          startAt: slot.startAt,
          endAt: slot.endAt,
          blockedFrom: slot.blockedFrom,
          blockedUntil: slot.blockedUntil,
          participants: input.participants,
          comment: input.comment ?? null,
          status: 'REQUESTED',
          source: opts.source ?? 'website',
          locale,
          totalAmount: price.total,
          idempotencyKey: input.idempotencyKey,
          termsAcceptedAt: now,
          termsVersion: TERMS_VERSION,
        },
      });
      if (autoLead) await ensureLeadForBooking(tx, booking);
      await logActivity(tx, {
        entityType: 'Booking',
        entityId: booking.id,
        action: 'booking.create',
        metadata: { source: booking.source, number: formatBookingNumber(booking.bookingNumber), total: booking.totalAmount },
      });
      const jobIds = await enqueueJobs(tx, bookingCreatedJobs(booking.id, Boolean(client.email), config));
      return { booking, jobIds };
    });
    return { booking, bookingNumber: formatBookingNumber(booking.bookingNumber), created: true, jobIds };
  } catch (error) {
    if (isExclusionViolation(error, 'Booking_no_room_overlap') || isUniqueViolation(error, 'idempotencyKey')) {
      // A concurrent submit with the same key (double click) may have won the race —
      // either constraint can fire first. Return that booking instead of an error.
      const winner = await db.booking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (winner) return { booking: winner, bookingNumber: formatBookingNumber(winner.bookingNumber), created: false, jobIds: [] };
      if (isExclusionViolation(error, 'Booking_no_room_overlap')) throw new PublicRequestError('SLOT_TAKEN');
    }
    throw error;
  }
}
