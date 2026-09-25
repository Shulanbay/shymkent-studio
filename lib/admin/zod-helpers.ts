import { z } from 'zod';
import { zonedTimeToUtc } from '@/lib/time';

/**
 * Date from a form. `<input type="datetime-local">` sends "YYYY-MM-DDTHH:MM"
 * without a zone — it is interpreted as Asia/Almaty wall-clock time, never as
 * the server's local time. ISO strings with a zone and Date objects pass through.
 */
export function parseStudioDateTime(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(value.trim());
  if (m) return zonedTimeToUtc(m[1], m[2]);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
}

export const studioDateTime = z.preprocess(parseStudioDateTime, z.date({ message: 'Некорректная дата' }));
export const optionalStudioDateTime = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : parseStudioDateTime(v)),
  z.date({ message: 'Некорректная дата' }).optional(),
);
