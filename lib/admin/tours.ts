import 'server-only';
import type { Prisma, PrismaClient, TourStatus } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import type { SessionUser } from '@/lib/auth/service';
import { checkSlot } from '@/lib/availability';
import { isExclusionViolation, loadTourBusy } from '@/lib/bookings/shared';
import { getEffectiveIntegrationConfig } from '@/lib/integrations/effective';
import { enqueueJobs, tourCancelledJobs, tourChangedJobs, tourConfirmedJobs, tourRescheduledJobs, skipObsoleteReminders } from '@/lib/outbox/jobs';
import { getReminderRules, getWorkingHours } from '@/lib/settings';
import { studioDayRange } from '@/lib/time';
import { advanceLinkedLead } from './leads';
import { RuleError } from './errors';
import { TOUR_STATUS_LABELS, TOUR_TRANSITIONS } from './labels';

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const tourFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(['NEW', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional().catch(undefined),
  from: optionalDate,
  to: optionalDate,
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type TourFilters = z.infer<typeof tourFiltersSchema>;
export const TOURS_PAGE_SIZE = 25;

export async function listTours(db: PrismaClient, filters: TourFilters) {
  const and: Prisma.TourRequestWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    const number = /^(?:t-?)?0*(\d{1,9})$/i.exec(q);
    const digits = q.replace(/\D/g, '');
    const or: Prisma.TourRequestWhereInput[] = [{ client: { name: { contains: q, mode: 'insensitive' } } }];
    if (number) or.push({ requestNumber: Number(number[1]) });
    if (digits.length >= 4) or.push({ client: { normalizedPhone: { contains: digits.replace(/^8/, '7') } } });
    and.push({ OR: or });
  }
  if (filters.status) and.push({ status: filters.status });
  if (filters.from) and.push({ scheduledAt: { gte: studioDayRange(filters.from).start } });
  if (filters.to) and.push({ scheduledAt: { lt: studioDayRange(filters.to).end } });
  const where = and.length ? { AND: and } : {};
  const [items, total] = await Promise.all([
    db.tourRequest.findMany({
      where,
      orderBy: [{ scheduledAt: 'desc' }, { id: 'asc' }],
      skip: (filters.page - 1) * TOURS_PAGE_SIZE,
      take: TOURS_PAGE_SIZE,
      include: { client: { select: { id: true, name: true, normalizedPhone: true } } },
    }),
    db.tourRequest.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / TOURS_PAGE_SIZE)) };
}

export async function changeTourStatus(db: PrismaClient, actor: SessionUser, input: { tourId: string; status: string }) {
  const status = z.enum(Object.keys(TOUR_TRANSITIONS) as [TourStatus]).parse(input.status);
  return db.$transaction(async (tx) => {
    const tour = await tx.tourRequest.findUnique({ where: { id: input.tourId }, include: { client: { select: { email: true } } } });
    if (!tour) throw new RuleError('Заявка не найдена');
    if (tour.status === status) return { jobIds: [] as string[] };
    if (!TOUR_TRANSITIONS[tour.status].includes(status)) {
      throw new RuleError(`Нельзя перевести тур из «${TOUR_STATUS_LABELS[tour.status]}» в «${TOUR_STATUS_LABELS[status]}»`);
    }
    await tx.tourRequest.update({ where: { id: tour.id }, data: { status } });
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'TourRequest',
      entityId: tour.id,
      action: 'tour.status',
      metadata: { from: tour.status, to: status },
    });
    const ctx = { config: await getEffectiveIntegrationConfig(tx), hasClientEmail: Boolean(tour.client.email) };
    if (status === 'CONFIRMED') {
      await advanceLinkedLead(tx, { tourRequestId: tour.id }, 'TOUR_SCHEDULED', actor.id, 'tour confirmed');
      return { jobIds: await enqueueJobs(tx, tourConfirmedJobs(tour.id, tour.scheduledAt, new Date(), ctx, await getReminderRules(tx))) };
    }
    if (status === 'CANCELLED') {
      await skipObsoleteReminders(tx, 'TourRequest', tour.id, 'cancelled');
      return { jobIds: await enqueueJobs(tx, tourCancelledJobs(tour.id, ctx)) };
    }
    return { jobIds: await enqueueJobs(tx, tourChangedJobs(tour.id, String(Date.now()), ctx.config)) };
  });
}

/** Moves a tour to another free slot (tours never overlap each other — DB-enforced). */
export async function rescheduleTour(db: PrismaClient, actor: SessionUser, input: { tourId: string; date: string; time: string }, now = new Date()) {
  const tour = await db.tourRequest.findUnique({ where: { id: input.tourId }, include: { client: { select: { email: true } } } });
  if (!tour) throw new RuleError('Заявка не найдена');
  if (tour.status !== 'NEW' && tour.status !== 'CONFIRMED') throw new RuleError('Перенести можно только новый или подтверждённый тур');
  const hours = await getWorkingHours(db);
  const slot = checkSlot({
    date: input.date,
    time: input.time,
    durationMinutes: hours.tour.durationMinutes,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    stepMinutes: hours.tour.slotStepMinutes,
    busy: await loadTourBusy(db, input.date, tour.id),
    hours,
    now,
    ignoreLeadAndHorizon: true,
  });
  if (!slot.ok) throw new RuleError(slot.reason === 'CONFLICT' ? 'На это время уже назначен другой тур' : 'Это время недоступно');
  try {
    return await db.$transaction(async (tx) => {
      await tx.tourRequest.update({ where: { id: tour.id }, data: { scheduledAt: slot.startAt, scheduledEnd: slot.endAt } });
      await logActivity(tx, {
        userId: actor.id,
        entityType: 'TourRequest',
        entityId: tour.id,
        action: 'tour.reschedule',
        metadata: { from: tour.scheduledAt.toISOString(), to: slot.startAt.toISOString() },
      });
      await skipObsoleteReminders(tx, 'TourRequest', tour.id, 'rescheduled', slot.startAt);
      const ctx = { config: await getEffectiveIntegrationConfig(tx), hasClientEmail: Boolean(tour.client.email) };
      return { jobIds: await enqueueJobs(tx, tourRescheduledJobs(tour.id, slot.startAt, tour.status === 'CONFIRMED', now, ctx, await getReminderRules(tx))) };
    });
  } catch (error) {
    if (isExclusionViolation(error, 'TourRequest_no_overlap')) throw new RuleError('На это время уже назначен другой тур');
    throw error;
  }
}

export async function updateTourNotes(db: PrismaClient, actor: SessionUser, input: { tourId: string; notes: string }) {
  const notes = z.string().max(5000).parse(input.notes).trim() || null;
  await db.$transaction(async (tx) => {
    const tour = await tx.tourRequest.findUnique({ where: { id: input.tourId } });
    if (!tour) throw new RuleError('Заявка не найдена');
    if (tour.notes === notes) return;
    await tx.tourRequest.update({ where: { id: tour.id }, data: { notes } });
    await logActivity(tx, { userId: actor.id, entityType: 'TourRequest', entityId: tour.id, action: 'tour.update', metadata: { fields: ['notes'] } });
  });
}
