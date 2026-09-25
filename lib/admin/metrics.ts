import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { hoursForDate } from '@/lib/availability';
import type { WorkingHours } from '@/lib/settings-schema';
import { addDays, isValidDateString, studioDayRange, timeToMinutes, todayInStudio } from '@/lib/time';

// Dashboard metrics. Everything is aggregated in PostgreSQL; nothing loads
// whole tables into memory. Periods are whole days in Asia/Almaty.

export type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'prev_month' | 'custom';

export interface Period {
  key: PeriodKey;
  /** Inclusive first and last local day. */
  firstDay: string;
  lastDay: string;
  from: Date;
  to: Date;
  label: string;
}

const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const monthEnd = (day: string) => {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const prevMonthDay = (day: string) => addDays(monthStart(day), -1);

function build(key: PeriodKey, firstDay: string, lastDay: string, label: string): Period {
  return { key, firstDay, lastDay, from: studioDayRange(firstDay).start, to: studioDayRange(lastDay).end, label };
}

export function resolvePeriod(input: { period?: string; from?: string; to?: string }, now = new Date()): Period {
  const today = todayInStudio(now);
  switch (input.period) {
    case 'today':
      return build('today', today, today, 'Сегодня');
    case '7d':
      return build('7d', addDays(today, -6), today, 'Последние 7 дней');
    case '30d':
      return build('30d', addDays(today, -29), today, 'Последние 30 дней');
    case 'prev_month': {
      const d = prevMonthDay(today);
      return build('prev_month', monthStart(d), monthEnd(d), 'Прошлый месяц');
    }
    case 'custom':
      if (input.from && input.to && isValidDateString(input.from) && isValidDateString(input.to) && input.from <= input.to) {
        // Cap at ~2 years so a typo cannot trigger a huge scan.
        const to = input.to > addDays(input.from, 731) ? addDays(input.from, 731) : input.to;
        return build('custom', input.from, to, `${input.from} — ${to}`);
      }
      return build('month', monthStart(today), monthEnd(today), 'Текущий месяц');
    default:
      return build('month', monthStart(today), monthEnd(today), 'Текущий месяц');
  }
}

/** The period of the same length right before `p` (previous calendar month for month periods). */
export function previousPeriod(p: Period): Period {
  if (p.key === 'month' || p.key === 'prev_month') {
    const d = prevMonthDay(p.firstDay);
    return build(p.key, monthStart(d), monthEnd(d), 'Предыдущий период');
  }
  const days = Math.round((studioDayRange(p.lastDay).end.getTime() - studioDayRange(p.firstDay).start.getTime()) / 86_400_000);
  return build(p.key, addDays(p.firstDay, -days), addDays(p.firstDay, -1), 'Предыдущий период');
}

/** Percent change; null when there is nothing to compare with (never divides by zero). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/** Net revenue = settled payments − refunds ± reversals, dated by when the money moved. */
export async function revenue(db: PrismaClient, from: Date, to: Date) {
  const rows = await db.$queryRaw<{ net: bigint | null; incoming: bigint | null; outgoing: bigint | null }[]>`
    SELECT
      SUM("signedAmount") AS net,
      SUM(CASE WHEN "signedAmount" > 0 THEN "signedAmount" ELSE 0 END) AS incoming,
      SUM(CASE WHEN "signedAmount" < 0 THEN -"signedAmount" ELSE 0 END) AS outgoing
    FROM "Payment"
    WHERE "status" = 'PAID' AND "paidAt" >= ${from} AND "paidAt" < ${to}`;
  const r = rows[0];
  return { net: Number(r?.net ?? 0), incoming: Number(r?.incoming ?? 0), outgoing: Number(r?.outgoing ?? 0) };
}

/** Open minutes per room in the period according to working hours and date exceptions. */
export function availableMinutes(hours: WorkingHours, firstDay: string, lastDay: string): number {
  let total = 0;
  for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) {
    const h = hoursForDate(hours, d);
    if (h) total += timeToMinutes(h.close) - timeToMinutes(h.open);
  }
  return total;
}

/** Share of open hours each active room is booked (cancelled bookings excluded, buffers not counted). */
export async function roomUtilization(db: PrismaClient, period: Period, hours: WorkingHours) {
  const [rooms, booked] = await Promise.all([
    db.room.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, nameRu: true, color: true } }),
    db.$queryRaw<{ roomId: string; minutes: number | null }[]>`
      SELECT "roomId",
             SUM(EXTRACT(EPOCH FROM (LEAST("endAt", ${period.to}) - GREATEST("startAt", ${period.from}))) / 60)::float8 AS minutes
      FROM "Booking"
      WHERE "status" <> 'CANCELLED' AND "startAt" < ${period.to} AND "endAt" > ${period.from}
      GROUP BY "roomId"`,
  ]);
  const open = availableMinutes(hours, period.firstDay, period.lastDay);
  const byRoom = new Map(booked.map((b) => [b.roomId, Math.round(b.minutes ?? 0)]));
  return rooms.map((r) => {
    const minutes = byRoom.get(r.id) ?? 0;
    return { ...r, bookedMinutes: minutes, openMinutes: open, percent: ratio(minutes, open) };
  });
}

export async function leadStats(db: PrismaClient, period: Period) {
  const rows = await db.lead.groupBy({ by: ['status'], where: { createdAt: { gte: period.from, lt: period.to } }, _count: { _all: true } });
  const count = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  const total = rows.reduce((sum, r) => sum + r._count._all, 0);
  return { total, won: count('WON'), lost: count('LOST'), newNow: count('NEW'), conversion: ratio(count('WON'), total) };
}

/** Clients with bookings in the period who have booked more than once (up to the end of the period). */
export async function repeatClients(db: PrismaClient, period: Period) {
  const rows = await db.$queryRaw<{ total: bigint; repeat: bigint }[]>`
    WITH period_clients AS (
      SELECT DISTINCT "clientId" FROM "Booking"
      WHERE "status" <> 'CANCELLED' AND "startAt" >= ${period.from} AND "startAt" < ${period.to}
    )
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE (
             SELECT COUNT(*) FROM "Booking" b
             WHERE b."clientId" = pc."clientId" AND b."status" <> 'CANCELLED' AND b."startAt" < ${period.to}
           ) >= 2) AS repeat
    FROM period_clients pc`;
  const total = Number(rows[0]?.total ?? 0);
  const repeat = Number(rows[0]?.repeat ?? 0);
  return { total, repeat, percent: ratio(repeat, total) };
}

export async function popularServices(db: PrismaClient, period: Period) {
  const rows = await db.booking.groupBy({
    by: ['serviceId'],
    where: { status: { not: 'CANCELLED' }, startAt: { gte: period.from, lt: period.to } },
    _count: { _all: true },
    _sum: { totalAmount: true },
    orderBy: { _count: { serviceId: 'desc' } },
  });
  const services = await db.service.findMany({ where: { id: { in: rows.map((r) => r.serviceId) } }, select: { id: true, nameRu: true } });
  const name = new Map(services.map((s) => [s.id, s.nameRu]));
  return rows.map((r) => ({ name: name.get(r.serviceId) ?? '—', count: r._count._all, amount: r._sum.totalAmount ?? 0 }));
}

export async function receivables(db: PrismaClient) {
  const rows = await db.$queryRaw<{ unpaid: bigint; partial: bigint; outstanding: bigint | null }[]>`
    SELECT COUNT(*) FILTER (WHERE "paymentStatus" = 'UNPAID') AS unpaid,
           COUNT(*) FILTER (WHERE "paymentStatus" = 'PARTIALLY_PAID') AS partial,
           SUM("totalAmount" - "paidAmount") AS outstanding
    FROM "Booking"
    WHERE "status" IN ('REQUESTED','CONTACTED','PENDING_PAYMENT','CONFIRMED','COMPLETED')
      AND "paymentStatus" IN ('UNPAID','PARTIALLY_PAID')`;
  return { unpaid: Number(rows[0]?.unpaid ?? 0), partial: Number(rows[0]?.partial ?? 0), outstanding: Number(rows[0]?.outstanding ?? 0) };
}
