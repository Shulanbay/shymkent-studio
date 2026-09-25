import { WEEKDAY_KEYS, workingHoursSchema, type WorkingHours } from '@/lib/settings-schema';
import { isValidDateString } from '@/lib/time';
import { RuleError } from './errors';

/** Exceptions as editable text: one per line, "2026-12-31 выходной" or "2026-12-31 12:00-18:00". */
export function exceptionsToText(exceptions: WorkingHours['exceptions']): string {
  return Object.entries(exceptions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, h]) => (h ? `${date} ${h.open}-${h.close}` : `${date} выходной`))
    .join('\n');
}

export function parseExceptions(text: string): WorkingHours['exceptions'] {
  const result: WorkingHours['exceptions'] = {};
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 366) throw new RuleError('Слишком много исключений');
  for (const line of lines) {
    const m = /^(\d{4}-\d{2}-\d{2})\s+(?:(выходной|closed)|([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-3]):([0-5]\d))$/i.exec(line);
    if (!m || !isValidDateString(m[1])) throw new RuleError(`Не удалось разобрать строку исключения: «${line.slice(0, 40)}»`);
    result[m[1]] = m[2] ? null : { open: `${m[3]}:${m[4]}`, close: `${m[5]}:${m[6]}` };
  }
  return result;
}

export function parseWorkingHoursForm(formData: FormData): WorkingHours {
  const num = (key: string) => Number(String(formData.get(key) ?? '').trim() || Number.NaN);
  const days = Object.fromEntries(
    WEEKDAY_KEYS.map((d) => [
      d,
      formData.get(`closed-${d}`) === 'on' ? null : { open: String(formData.get(`open-${d}`) ?? ''), close: String(formData.get(`close-${d}`) ?? '') },
    ]),
  );
  return workingHoursSchema.parse({
    timeZone: 'Asia/Almaty',
    days,
    exceptions: parseExceptions(String(formData.get('exceptions') ?? '')),
    slotStepMinutes: num('slotStepMinutes'),
    minLeadMinutes: num('minLeadMinutes'),
    maxAdvanceDays: num('maxAdvanceDays'),
    tour: { durationMinutes: num('tourDurationMinutes'), slotStepMinutes: num('tourSlotStepMinutes') },
  });
}
