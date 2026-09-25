// Calendar arithmetic in the studio time zone. Pure module.
// All instants are stored in UTC; business rules (working hours, "today",
// slot times) are evaluated in Asia/Almaty via Intl, not a hard-coded offset.

export const STUDIO_TZ = 'Asia/Almaty';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDateString(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isValidTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(tz, f);
  }
  return f;
}

function zonedParts(instant: Date, tz: string) {
  const parts: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(instant)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Offset of `tz` from UTC at `instant`, in minutes (Almaty: +300). */
export function tzOffsetMinutes(instant: Date, tz: string = STUDIO_TZ): number {
  const p = zonedParts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** Local wall-clock date + time in `tz` → UTC instant. */
export function zonedTimeToUtc(date: string, time: string, tz: string = STUDIO_TZ): Date {
  if (!isValidDateString(date) || !isValidTimeString(time)) throw new RangeError('Invalid date or time');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = tzOffsetMinutes(new Date(guess), tz);
  let result = guess - offset * 60_000;
  const corrected = tzOffsetMinutes(new Date(result), tz);
  if (corrected !== offset) result = guess - corrected * 60_000;
  return new Date(result);
}

/** UTC instant → local date ("YYYY-MM-DD") and time ("HH:MM") in `tz`. */
export function utcToZoned(instant: Date, tz: string = STUDIO_TZ): { date: string; time: string } {
  const p = zonedParts(instant, tz);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

export function todayInStudio(now: Date = new Date()): string {
  return utcToZoned(now).date;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Monday of the week that contains `date`. */
export function startOfIsoWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** [start, end) UTC instants covering the whole local day. */
export function studioDayRange(date: string): { start: Date; end: Date } {
  return { start: zonedTimeToUtc(date, '00:00'), end: zonedTimeToUtc(addDays(date, 1), '00:00') };
}
