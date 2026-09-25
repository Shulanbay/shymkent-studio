// Slot generation and validation. Pure module — the same function decides
// which slots the public form shows and whether the server accepts a booking,
// so the UI can never offer a time the server would reject (or vice versa).

import type { DayHours, WorkingHours } from '@/lib/settings-schema';
import { addDays, isValidDateString, isoWeekday, timeToMinutes, todayInStudio, utcToZoned, zonedTimeToUtc } from '@/lib/time';

export interface BusyInterval {
  from: Date;
  until: Date;
}

export interface SlotRequest {
  date: string;
  time: string;
  durationMinutes: number;
  /** Room buffers (0 for tours). */
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  stepMinutes: number;
  busy: BusyInterval[];
  hours: WorkingHours;
  now: Date;
  /** Staff actions (reschedule) may skip lead-time / horizon limits, never the rest. */
  ignoreLeadAndHorizon?: boolean;
}

export type SlotRejection = 'INVALID_DATE' | 'PAST' | 'TOO_SOON' | 'TOO_FAR' | 'CLOSED' | 'OUTSIDE_HOURS' | 'OFF_GRID' | 'CONFLICT';

export type SlotCheck =
  | { ok: true; startAt: Date; endAt: Date; blockedFrom: Date; blockedUntil: Date }
  | { ok: false; reason: SlotRejection };

export function hoursForDate(hours: WorkingHours, date: string): DayHours | null {
  if (Object.prototype.hasOwnProperty.call(hours.exceptions ?? {}, date)) return hours.exceptions[date] ?? null;
  return hours.days[String(isoWeekday(date)) as keyof WorkingHours['days']] ?? null;
}

export function overlaps(a: BusyInterval, b: BusyInterval): boolean {
  return a.from < b.until && b.from < a.until;
}

export function checkSlot(req: SlotRequest): SlotCheck {
  if (!isValidDateString(req.date)) return { ok: false, reason: 'INVALID_DATE' };
  const day = hoursForDate(req.hours, req.date);
  if (!day) return { ok: false, reason: 'CLOSED' };

  let startAt: Date;
  try {
    startAt = zonedTimeToUtc(req.date, req.time);
  } catch {
    return { ok: false, reason: 'INVALID_DATE' };
  }
  const endAt = new Date(startAt.getTime() + req.durationMinutes * 60_000);

  if (startAt.getTime() <= req.now.getTime()) return { ok: false, reason: 'PAST' };
  if (!req.ignoreLeadAndHorizon) {
    if (startAt.getTime() < req.now.getTime() + req.hours.minLeadMinutes * 60_000) return { ok: false, reason: 'TOO_SOON' };
    if (req.date > addDays(todayInStudio(req.now), req.hours.maxAdvanceDays)) return { ok: false, reason: 'TOO_FAR' };
  }

  const openMin = timeToMinutes(day.open);
  const closeMin = timeToMinutes(day.close);
  const startMin = timeToMinutes(req.time);
  if (startMin < openMin || startMin + req.durationMinutes > closeMin) return { ok: false, reason: 'OUTSIDE_HOURS' };
  if ((startMin - openMin) % req.stepMinutes !== 0) return { ok: false, reason: 'OFF_GRID' };

  const blockedFrom = new Date(startAt.getTime() - req.bufferBeforeMinutes * 60_000);
  const blockedUntil = new Date(endAt.getTime() + req.bufferAfterMinutes * 60_000);
  if (req.busy.some((b) => overlaps({ from: blockedFrom, until: blockedUntil }, b))) return { ok: false, reason: 'CONFLICT' };

  return { ok: true, startAt, endAt, blockedFrom, blockedUntil };
}

export interface Slot {
  time: string;
  startAt: string;
  endAt: string;
}

/** All bookable start times for the day, in order. Only future, free, in-hours slots. */
export function generateSlots(req: Omit<SlotRequest, 'time'>): Slot[] {
  const day = isValidDateString(req.date) ? hoursForDate(req.hours, req.date) : null;
  if (!day) return [];
  const slots: Slot[] = [];
  const openMin = timeToMinutes(day.open);
  const closeMin = timeToMinutes(day.close);
  for (let m = openMin; m + req.durationMinutes <= closeMin; m += req.stepMinutes) {
    const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const check = checkSlot({ ...req, time });
    if (check.ok) slots.push({ time, startAt: check.startAt.toISOString(), endAt: check.endAt.toISOString() });
  }
  return slots;
}

/** Local date of an instant — convenience re-export for callers building queries. */
export const localDateOf = (instant: Date) => utcToZoned(instant).date;
