import 'server-only';
import type { PrismaClient, TourRequest } from '@prisma/client';
import { logActivity } from '@/lib/activity';
import { checkSlot } from '@/lib/availability';
import { PublicRequestError, isExclusionViolation, isUniqueViolation, loadTourBusy, upsertClientByPhone } from '@/lib/bookings/shared';
import type { IntegrationConfig } from '@/lib/integrations/config';
import { getEffectiveIntegrationConfig } from '@/lib/integrations/effective';
import { enqueueJobs, tourCreatedJobs } from '@/lib/outbox/jobs';
import { formatKzPhone, normalizeKzPhone } from '@/lib/phone';
import { formatTourNumber, type PublicTourInput } from '@/lib/public/schemas';
import { getWorkingHours } from '@/lib/settings';
import { ensureLeadForTour } from '@/lib/admin/leads';

export interface CreatedTour {
  tour: TourRequest;
  requestNumber: string;
  created: boolean;
  jobIds: string[];
}

/** Creates a free studio tour request. Tours share one host: no overlapping tours (DB-enforced). */
export async function createPublicTour(
  db: PrismaClient,
  input: PublicTourInput,
  opts: { now?: Date; config?: IntegrationConfig } = {},
): Promise<CreatedTour> {
  const now = opts.now ?? new Date();

  const existing = await db.tourRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { tour: existing, requestNumber: formatTourNumber(existing.requestNumber), created: false, jobIds: [] };

  const normalizedPhone = normalizeKzPhone(input.phone);
  if (!normalizedPhone) throw new PublicRequestError('INVALID_PHONE');

  const hours = await getWorkingHours(db);
  const slot = checkSlot({
    date: input.date,
    time: input.time,
    durationMinutes: hours.tour.durationMinutes,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    stepMinutes: hours.tour.slotStepMinutes,
    busy: await loadTourBusy(db, input.date),
    hours,
    now,
  });
  if (!slot.ok) throw new PublicRequestError(slot.reason === 'CONFLICT' ? 'SLOT_TAKEN' : slot.reason);

  const config = opts.config ?? (await getEffectiveIntegrationConfig(db));
  const locale = input.locale === 'kk' ? 'KK' : 'RU';
  try {
    const { tour, jobIds } = await db.$transaction(async (tx) => {
      const client = await upsertClientByPhone(tx, {
        name: input.name,
        normalizedPhone,
        phone: formatKzPhone(normalizedPhone),
        locale,
        source: 'website-tour',
      });
      const tour = await tx.tourRequest.create({
        data: {
          clientId: client.id,
          scheduledAt: slot.startAt,
          scheduledEnd: slot.endAt,
          format: input.format ?? null,
          status: 'NEW',
          locale,
          source: 'website',
          idempotencyKey: input.idempotencyKey,
          consentAt: now,
        },
      });
      await ensureLeadForTour(tx, tour);
      await logActivity(tx, {
        entityType: 'TourRequest',
        entityId: tour.id,
        action: 'tour.create',
        metadata: { source: 'website', number: formatTourNumber(tour.requestNumber) },
      });
      const jobIds = await enqueueJobs(tx, tourCreatedJobs(tour.id, config));
      return { tour, jobIds };
    });
    return { tour, requestNumber: formatTourNumber(tour.requestNumber), created: true, jobIds };
  } catch (error) {
    if (isExclusionViolation(error, 'TourRequest_no_overlap') || isUniqueViolation(error, 'idempotencyKey')) {
      const winner = await db.tourRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (winner) return { tour: winner, requestNumber: formatTourNumber(winner.requestNumber), created: false, jobIds: [] };
      if (isExclusionViolation(error, 'TourRequest_no_overlap')) throw new PublicRequestError('SLOT_TAKEN');
    }
    throw error;
  }
}
