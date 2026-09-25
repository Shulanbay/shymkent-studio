// Cancellation / reschedule policy. Pure module: values come from the
// `cancellation_policy` setting (editable in the CRM), with these defaults.

import { z } from 'zod';

export const cancellationPolicySchema = z
  .object({
    /** Cancelling strictly more than this many hours before the session → full refund. */
    fullRefundHours: z.number().int().min(1).max(24 * 30),
    /** Cancelling at least this many hours before (and not full-refund) → partial refund. */
    partialRefundHours: z.number().int().min(0).max(24 * 30),
    partialRefundPercent: z.number().int().min(0).max(100),
    /** How many free reschedules a booking gets. */
    freeReschedules: z.number().int().min(0).max(10),
    /** A free reschedule must be requested strictly more than this many hours before. */
    rescheduleMinHours: z.number().int().min(0).max(24 * 30),
  })
  .refine((p) => p.partialRefundHours <= p.fullRefundHours, {
    message: 'Порог частичного возврата не может быть больше порога полного возврата',
    path: ['partialRefundHours'],
  });

export type CancellationPolicy = z.infer<typeof cancellationPolicySchema>;

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  fullRefundHours: 48,
  partialRefundHours: 24,
  partialRefundPercent: 80,
  freeReschedules: 1,
  rescheduleMinHours: 24,
};

const HOUR_MS = 60 * 60 * 1000;

export type RefundTier = 'FULL' | 'PARTIAL' | 'NONE';

export interface RefundQuote {
  tier: RefundTier;
  percent: number;
  /** Suggested refund in KZT. Staff may override it (see clampRefundOverride). */
  amount: number;
  hoursBefore: number;
}

export function hoursUntil(startAt: Date, now: Date): number {
  return (startAt.getTime() - now.getTime()) / HOUR_MS;
}

export function computeRefund(
  policy: CancellationPolicy,
  input: { paidAmount: number; startAt: Date; now?: Date },
): RefundQuote {
  const hoursBefore = hoursUntil(input.startAt, input.now ?? new Date());
  let tier: RefundTier;
  let percent: number;
  if (hoursBefore > policy.fullRefundHours) {
    tier = 'FULL';
    percent = 100;
  } else if (hoursBefore >= policy.partialRefundHours) {
    tier = 'PARTIAL';
    percent = policy.partialRefundPercent;
  } else {
    tier = 'NONE';
    percent = 0;
  }
  const paid = Math.max(0, Math.floor(input.paidAmount));
  return { tier, percent, amount: Math.floor((paid * percent) / 100), hoursBefore };
}

/** Staff can set any refund between 0 and what was actually paid. */
export function clampRefundOverride(amount: number, paidAmount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.min(Math.max(0, Math.floor(amount)), Math.max(0, paidAmount));
}

export function canRescheduleFree(
  policy: CancellationPolicy,
  input: { rescheduleCount: number; startAt: Date; now?: Date },
): { allowed: boolean; reason?: 'LIMIT_REACHED' | 'TOO_LATE' } {
  if (input.rescheduleCount >= policy.freeReschedules) return { allowed: false, reason: 'LIMIT_REACHED' };
  if (hoursUntil(input.startAt, input.now ?? new Date()) <= policy.rescheduleMinHours) {
    return { allowed: false, reason: 'TOO_LATE' };
  }
  return { allowed: true };
}

// ─── Human-readable texts (RU / KK) ───────────────────────────────────────────

type Lang = 'ru' | 'kk';

function ruPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function ruHours(n: number) {
  return `${n} ${ruPlural(n, 'час', 'часа', 'часов')}`;
}

export interface PolicyTexts {
  full: string;
  partial: string;
  none: string;
  reschedule: string;
  override: string;
  /** One-paragraph summary (FAQ, emails). */
  summary: string;
  /** Very short line for the booking sidebar. */
  short: string;
}

export function policyTexts(policy: CancellationPolicy, lang: Lang): PolicyTexts {
  const { fullRefundHours: f, partialRefundHours: p, partialRefundPercent: pct, freeReschedules: r, rescheduleMinHours: rh } = policy;
  if (lang === 'kk') {
    const full = `Түсірілімге ${f} сағаттан көп уақыт қалғанда бас тартсаңыз — толық қайтарым.`;
    const partial =
      p < f ? `${p}–${f} сағат қалғанда бас тартсаңыз — ${pct}% қайтарылады.` : '';
    const none = p > 0 ? `${p} сағаттан аз уақыт қалғанда — қайтарым жоқ.` : '';
    const reschedule =
      r > 0
        ? `Түсірілімге ${rh} сағаттан көп уақыт қалғанда ${r} рет тегін ауыстыруға болады.`
        : 'Тегін ауыстыру қарастырылмаған.';
    const override = 'Ерекше жағдайларда қайтарым сомасын әкімші жеке қарастыруы мүмкін.';
    return {
      full,
      partial,
      none,
      reschedule,
      override,
      summary: [full, partial, none, reschedule].filter(Boolean).join(' '),
      short: `✓ ${f} сағаттан ерте бас тартсаңыз — толық қайтарым`,
    };
  }
  const full = `Отмена более чем за ${ruHours(f)} до съёмки — полный возврат.`;
  const partial = p < f ? `Отмена за ${p}–${ruHours(f)} — возврат ${pct}%.` : '';
  const none = p > 0 ? `Отмена менее чем за ${ruHours(p)} — без возврата.` : '';
  const reschedule =
    r > 0
      ? `${r === 1 ? 'Один бесплатный перенос' : `Бесплатных переносов: ${r}`} — при запросе более чем за ${ruHours(rh)} до съёмки.`
      : 'Бесплатный перенос не предусмотрен.';
  const override = 'В исключительных случаях сумму возврата может пересмотреть администратор.';
  return {
    full,
    partial,
    none,
    reschedule,
    override,
    summary: [full, partial, none, reschedule].filter(Boolean).join(' '),
    short: `✓ Полный возврат при отмене более чем за ${ruHours(f)}`,
  };
}
