import { describe, expect, it } from 'vitest';
import { checkSlot, generateSlots, hoursForDate } from '@/lib/availability';
import { DEFAULT_WORKING_HOURS, type WorkingHours } from '@/lib/settings-schema';
import { isoWeekday, studioDayRange, utcToZoned, zonedTimeToUtc } from '@/lib/time';

const DAY = '2026-11-20'; // a Friday
const now = zonedTimeToUtc('2026-11-18', '09:00');
const hours: WorkingHours = DEFAULT_WORKING_HOURS;

const base = {
  date: DAY,
  durationMinutes: 60,
  bufferBeforeMinutes: 15,
  bufferAfterMinutes: 15,
  stepMinutes: 30,
  busy: [] as { from: Date; until: Date }[],
  hours,
  now,
};

describe('Asia/Almaty time', () => {
  it('converts local wall-clock time to UTC (+05:00)', () => {
    expect(zonedTimeToUtc('2026-11-20', '10:00').toISOString()).toBe('2026-11-20T05:00:00.000Z');
    expect(utcToZoned(new Date('2026-11-20T19:30:00Z'))).toEqual({ date: '2026-11-21', time: '00:30' });
    expect(studioDayRange('2026-11-20').start.toISOString()).toBe('2026-11-19T19:00:00.000Z');
    expect(isoWeekday('2026-11-20')).toBe(5);
    expect(isoWeekday('2026-11-22')).toBe(7);
  });
});

describe('generateSlots', () => {
  it('returns every in-hours start time on the grid', () => {
    const slots = generateSlots(base);
    expect(slots[0].time).toBe('10:00');
    expect(slots.at(-1)!.time).toBe('21:00'); // 21:00 + 60 min = closing time
    expect(slots).toHaveLength(23);
    expect(slots[0].startAt).toBe('2026-11-20T05:00:00.000Z');
  });

  it('respects the room buffers around existing bookings', () => {
    // Existing 12:00–13:00 booking, blocked 11:45–13:15.
    const busy = [{ from: zonedTimeToUtc(DAY, '11:45'), until: zonedTimeToUtc(DAY, '13:15') }];
    const times = generateSlots({ ...base, busy }).map((s) => s.time);
    expect(times).not.toContain('11:00'); // 10:45–12:15 overlaps
    expect(times).toContain('10:30'); // 10:15–11:45 touches, allowed
    expect(times).not.toContain('13:00');
    expect(times).toContain('13:30'); // 13:15–14:45 touches, allowed
  });

  it('is empty on closed days and follows date exceptions', () => {
    const closedSunday: WorkingHours = { ...hours, days: { ...hours.days, '7': null } };
    expect(generateSlots({ ...base, date: '2026-11-22', hours: closedSunday })).toEqual([]);
    const holiday: WorkingHours = { ...hours, exceptions: { [DAY]: null } };
    expect(generateSlots({ ...base, hours: holiday })).toEqual([]);
    const shortDay: WorkingHours = { ...hours, exceptions: { [DAY]: { open: '12:00', close: '15:00' } } };
    expect(generateSlots({ ...base, hours: shortDay }).map((s) => s.time)).toEqual(['12:00', '12:30', '13:00', '13:30', '14:00']);
    expect(hoursForDate(shortDay, DAY)).toEqual({ open: '12:00', close: '15:00' });
  });

  it('hides past and too-soon slots on the current day', () => {
    const today = { ...base, now: zonedTimeToUtc(DAY, '13:10') };
    const times = generateSlots(today).map((s) => s.time);
    expect(times[0]).toBe('15:30'); // now + 120 min lead time = 15:10 → next grid slot
  });
});

describe('checkSlot', () => {
  it.each([
    ['2026-11-17', '12:00', 'PAST'],
    ['2026-11-20', '09:30', 'OUTSIDE_HOURS'],
    ['2026-11-20', '21:30', 'OUTSIDE_HOURS'],
    ['2026-11-20', '12:15', 'OFF_GRID'],
    ['2027-06-01', '12:00', 'TOO_FAR'],
    ['2026-02-30', '12:00', 'INVALID_DATE'],
  ])('%s %s → %s', (date, time, reason) => {
    expect(checkSlot({ ...base, date, time })).toEqual({ ok: false, reason });
  });

  it('rejects a slot inside the lead time', () => {
    expect(checkSlot({ ...base, date: '2026-11-18', time: '10:00' })).toEqual({ ok: false, reason: 'TOO_SOON' });
  });

  it('returns buffered block boundaries for an accepted slot', () => {
    const result = checkSlot({ ...base, time: '12:00' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blockedFrom.toISOString()).toBe(zonedTimeToUtc(DAY, '11:45').toISOString());
    expect(result.blockedUntil.toISOString()).toBe(zonedTimeToUtc(DAY, '13:15').toISOString());
  });

  it('staff reschedules may skip lead time and horizon, but never past or conflicts', () => {
    expect(checkSlot({ ...base, date: '2026-11-18', time: '10:00', ignoreLeadAndHorizon: true }).ok).toBe(true);
    expect(checkSlot({ ...base, date: '2027-06-01', time: '12:00', ignoreLeadAndHorizon: true }).ok).toBe(true);
    expect(checkSlot({ ...base, date: '2026-11-17', time: '12:00', ignoreLeadAndHorizon: true })).toEqual({ ok: false, reason: 'PAST' });
  });
});

describe('calendar overlap layout', async () => {
  const { layoutOverlaps } = await import('@/lib/admin/calendar-layout');
  it('gives non-overlapping blocks the full width and splits only real overlaps', () => {
    const layout = layoutOverlaps([
      { key: 'a', startMin: 600, endMin: 660 },
      { key: 'b', startMin: 630, endMin: 720 },
      { key: 'c', startMin: 660, endMin: 700 },
      { key: 'd', startMin: 800, endMin: 860 },
    ]);
    expect(layout.get('a')).toEqual({ col: 0, cols: 2 });
    expect(layout.get('b')).toEqual({ col: 1, cols: 2 });
    expect(layout.get('c')).toEqual({ col: 0, cols: 2 }); // reuses column 0 after "a" ends
    expect(layout.get('d')).toEqual({ col: 0, cols: 1 });
  });
});
