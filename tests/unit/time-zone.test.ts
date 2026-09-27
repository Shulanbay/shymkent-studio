import { afterEach, describe, expect, it } from 'vitest';
import { checkSlot, generateSlots } from '@/lib/availability';
import { parseStudioDateTime } from '@/lib/admin/zod-helpers';
import { formatDate, formatDateTime, formatTime } from '@/lib/admin/format';
import { DEFAULT_WORKING_HOURS } from '@/lib/settings-schema';
import {
  STUDIO_UTC_OFFSET_MINUTES,
  addDays,
  studioDayRange,
  studioTimeZoneDataOk,
  todayInStudio,
  tzOffsetMinutes,
  utcToZoned,
  zonedTimeToUtc,
} from '@/lib/time';

// Business time is always Shymkent (Asia/Almaty, UTC+5) — never the time zone
// of the server or the visitor's computer.

const hours = DEFAULT_WORKING_HOURS; // 10:00–22:00 every day, 30-min grid
const slotBase = { durationMinutes: 60, bufferBeforeMinutes: 15, bufferAfterMinutes: 15, stepMinutes: 30, busy: [], hours };

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

describe('Asia/Almaty is UTC+5 in this runtime', () => {
  it('has current tzdata (Kazakhstan moved to a single UTC+5 zone on 1 March 2024)', () => {
    expect(STUDIO_UTC_OFFSET_MINUTES).toBe(300);
    expect(studioTimeZoneDataOk(new Date('2026-09-26T12:00:00Z'))).toBe(true);
    expect(tzOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(300);
    expect(tzOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(300); // no DST
  });
});

describe('does not depend on the machine time zone', () => {
  it.each(['America/New_York', 'UTC', 'Asia/Tokyo', 'Pacific/Kiritimati'])('same results with TZ=%s', (tz) => {
    process.env.TZ = tz;
    expect(zonedTimeToUtc('2026-11-20', '10:00').toISOString()).toBe('2026-11-20T05:00:00.000Z');
    expect(utcToZoned(new Date('2026-11-20T05:00:00Z'))).toEqual({ date: '2026-11-20', time: '10:00' });
    expect(todayInStudio(new Date('2026-11-20T19:00:00Z'))).toBe('2026-11-21');
    expect(formatDateTime(new Date('2026-11-20T05:00:00Z'))).toBe('20.11.2026, 10:00');
    expect(formatTime(new Date('2026-11-20T16:59:00Z'))).toBe('21:59');
    expect(formatDate(new Date('2026-11-20T19:30:00Z'))).toBe('21.11.2026');
    expect(parseStudioDateTime('2026-11-20T10:00')?.toISOString()).toBe('2026-11-20T05:00:00.000Z');
  });
});

describe('day boundaries', () => {
  it('"today" in the studio switches at Shymkent midnight (19:00 UTC)', () => {
    expect(todayInStudio(new Date('2026-09-26T18:59:59Z'))).toBe('2026-09-26');
    expect(todayInStudio(new Date('2026-09-26T19:00:00Z'))).toBe('2026-09-27');
  });

  it('converts start and end of day, year change included', () => {
    expect(zonedTimeToUtc('2026-12-31', '23:30').toISOString()).toBe('2026-12-31T18:30:00.000Z');
    expect(zonedTimeToUtc('2027-01-01', '00:00').toISOString()).toBe('2026-12-31T19:00:00.000Z');
    expect(utcToZoned(new Date('2026-12-31T19:00:00Z'))).toEqual({ date: '2027-01-01', time: '00:00' });
    const { start, end } = studioDayRange('2026-12-31');
    expect([start.toISOString(), end.toISOString()]).toEqual(['2026-12-30T19:00:00.000Z', '2026-12-31T19:00:00.000Z']);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('rejects invalid calendar dates and times', () => {
    expect(() => zonedTimeToUtc('2026-02-30', '10:00')).toThrow(RangeError);
    expect(() => zonedTimeToUtc('2026-11-20', '24:00')).toThrow(RangeError);
    expect(checkSlot({ ...slotBase, date: '2026-02-30', time: '10:00', now: new Date('2026-01-01T00:00:00Z') })).toEqual({ ok: false, reason: 'INVALID_DATE' });
  });
});

describe('past time and working hours', () => {
  // 13:10 in Shymkent on 20 Nov 2026 (08:10 UTC), no lead time.
  const now = zonedTimeToUtc('2026-11-20', '13:10');
  const noLead = { ...hours, minLeadMinutes: 0 };

  it('today offers only future starts', () => {
    const slots = generateSlots({ ...slotBase, hours: noLead, date: '2026-11-20', now });
    expect(slots[0].time).toBe('13:30');
    expect(slots.at(-1)!.time).toBe('21:00');
  });

  it('a slot that already started or just passed is PAST, even a minute ago', () => {
    expect(checkSlot({ ...slotBase, hours: noLead, date: '2026-11-20', time: '13:00', now })).toEqual({ ok: false, reason: 'PAST' });
    expect(checkSlot({ ...slotBase, hours: noLead, date: '2026-11-19', time: '15:00', now })).toEqual({ ok: false, reason: 'PAST' });
  });

  it('respects the minimum lead time', () => {
    const lead = { ...hours, minLeadMinutes: 120 };
    expect(checkSlot({ ...slotBase, hours: lead, date: '2026-11-20', time: '15:00', now })).toEqual({ ok: false, reason: 'TOO_SOON' });
    expect(checkSlot({ ...slotBase, hours: lead, date: '2026-11-20', time: '15:30', now }).ok).toBe(true);
  });

  it('a session must end by closing time and start on the grid', () => {
    const later = zonedTimeToUtc('2026-11-01', '09:00');
    expect(checkSlot({ ...slotBase, durationMinutes: 120, date: '2026-11-20', time: '20:00', now: later }).ok).toBe(true);
    expect(checkSlot({ ...slotBase, durationMinutes: 120, date: '2026-11-20', time: '20:30', now: later })).toEqual({ ok: false, reason: 'OUTSIDE_HOURS' });
    expect(checkSlot({ ...slotBase, date: '2026-11-20', time: '09:30', now: later })).toEqual({ ok: false, reason: 'OUTSIDE_HOURS' });
    expect(checkSlot({ ...slotBase, date: '2026-11-20', time: '10:15', now: later })).toEqual({ ok: false, reason: 'OFF_GRID' });
  });

  it('closed days and date exceptions', () => {
    const later = zonedTimeToUtc('2026-11-01', '09:00');
    const withHoliday = { ...hours, exceptions: { '2026-12-16': null, '2026-12-31': { open: '10:00', close: '15:00' } } };
    expect(checkSlot({ ...slotBase, hours: withHoliday, date: '2026-12-16', time: '12:00', now: later })).toEqual({ ok: false, reason: 'CLOSED' });
    const shortDay = generateSlots({ ...slotBase, hours: withHoliday, date: '2026-12-31', now: later });
    expect(shortDay.at(-1)!.time).toBe('14:00');
  });
});

describe('conflicts', () => {
  const now = zonedTimeToUtc('2026-11-01', '09:00');
  const booked = (date: string, from: string, to: string) => ({ from: zonedTimeToUtc(date, from), until: zonedTimeToUtc(date, to) });

  it('the room buffers keep 15 minutes free before and after another booking', () => {
    const busy = [booked('2026-11-20', '11:45', '13:15')]; // 12:00–13:00 booking incl. buffers
    const times = generateSlots({ ...slotBase, date: '2026-11-20', busy, now }).map((s) => s.time);
    expect(times).toContain('10:30'); // 10:15–11:45 blocked, touches but does not overlap
    expect(times).not.toContain('11:00');
    expect(times).not.toContain('12:30');
    expect(times).toContain('13:30');
  });

  it('a booking from the previous evening that runs past midnight blocks the next morning only as far as it reaches', () => {
    const late = { ...hours, days: { ...hours.days, '5': { open: '10:00', close: '23:30' } } };
    const busy = [{ from: zonedTimeToUtc('2026-11-20', '22:15'), until: zonedTimeToUtc('2026-11-21', '00:15') }];
    expect(checkSlot({ ...slotBase, hours: late, date: '2026-11-20', time: '22:30', durationMinutes: 60, busy, now })).toEqual({ ok: false, reason: 'CONFLICT' });
    expect(checkSlot({ ...slotBase, date: '2026-11-21', time: '10:00', busy, now }).ok).toBe(true);
  });
});
