import { Prisma, type PrismaClient } from '@prisma/client';
import type { BusyInterval } from '@/lib/availability';
import type { PublicErrorCode } from '@/lib/public/messages';
import { studioDayRange } from '@/lib/time';

type Db = PrismaClient | Prisma.TransactionClient;

export class PublicRequestError extends Error {
  constructor(public readonly code: PublicErrorCode) {
    super(code);
  }
}

/** PostgreSQL exclusion-constraint violation (SQLSTATE 23P01) for the given constraint. */
export function isExclusionViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof Error)) return false;
  const meta = (error as { meta?: Record<string, unknown> }).meta;
  const text = `${error.message} ${meta ? JSON.stringify(meta) : ''}`;
  return text.includes(constraint) || text.includes('23P01');
}

export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  if (!field) return true;
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? '').includes(field);
}

/** Blocked intervals of active bookings in a room that touch the given local day (±1 day for buffers). */
export async function loadRoomBusy(db: Db, roomId: string, date: string, excludeBookingId?: string): Promise<BusyInterval[]> {
  const { start, end } = studioDayRange(date);
  const rows = await db.booking.findMany({
    where: {
      roomId,
      status: { not: 'CANCELLED' },
      blockedUntil: { gt: new Date(start.getTime() - 24 * 3600_000) },
      blockedFrom: { lt: new Date(end.getTime() + 24 * 3600_000) },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { blockedFrom: true, blockedUntil: true },
  });
  return rows.map((r) => ({ from: r.blockedFrom, until: r.blockedUntil }));
}

export async function loadTourBusy(db: Db, date: string, excludeTourId?: string): Promise<BusyInterval[]> {
  const { start, end } = studioDayRange(date);
  const rows = await db.tourRequest.findMany({
    where: {
      status: { not: 'CANCELLED' },
      scheduledEnd: { gt: start },
      scheduledAt: { lt: end },
      ...(excludeTourId ? { id: { not: excludeTourId } } : {}),
    },
    select: { scheduledAt: true, scheduledEnd: true },
  });
  return rows.map((r) => ({ from: r.scheduledAt, until: r.scheduledEnd }));
}

/**
 * Finds the client by normalised phone or creates it — one client per phone.
 * Uses a native INSERT … ON CONFLICT, so concurrent requests cannot create duplicates.
 */
export async function upsertClientByPhone(
  tx: Prisma.TransactionClient,
  data: { name: string; normalizedPhone: string; phone: string; email?: string; locale: 'RU' | 'KK'; source: string },
) {
  const client = await tx.client.upsert({
    where: { normalizedPhone: data.normalizedPhone },
    create: {
      name: data.name,
      phone: data.phone,
      normalizedPhone: data.normalizedPhone,
      email: data.email ?? null,
      locale: data.locale,
      source: data.source,
    },
    update: { locale: data.locale },
  });
  // Existing clients keep their CRM-edited name; only fill in a missing email.
  if (!client.email && data.email) {
    return tx.client.update({ where: { id: client.id }, data: { email: data.email } });
  }
  return client;
}
