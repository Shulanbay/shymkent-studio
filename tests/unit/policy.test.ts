import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CANCELLATION_POLICY as P,
  canRescheduleFree,
  cancellationPolicySchema,
  clampRefundOverride,
  computeRefund,
  policyTexts,
} from '@/lib/policy';

const now = new Date('2026-10-01T10:00:00+05:00');
const inHours = (h: number) => new Date(now.getTime() + h * 3600_000);

describe('default cancellation policy', () => {
  it('matches the business rules', () => {
    expect(P).toEqual({
      fullRefundHours: 48,
      partialRefundHours: 24,
      partialRefundPercent: 80,
      freeReschedules: 1,
      rescheduleMinHours: 24,
    });
  });
});

describe('computeRefund', () => {
  const paid = 40_000;
  it.each([
    [72, 'FULL', 40_000],
    [48.01, 'FULL', 40_000],
    [48, 'PARTIAL', 32_000],
    [30, 'PARTIAL', 32_000],
    [24, 'PARTIAL', 32_000],
    [23.99, 'NONE', 0],
    [1, 'NONE', 0],
    [-2, 'NONE', 0],
  ] as const)('%s h before → %s (%s ₸)', (hours, tier, amount) => {
    const quote = computeRefund(P, { paidAmount: paid, startAt: inHours(hours), now });
    expect(quote.tier).toBe(tier);
    expect(quote.amount).toBe(amount);
  });

  it('never refunds more than was paid and handles unpaid bookings', () => {
    expect(computeRefund(P, { paidAmount: 0, startAt: inHours(100), now }).amount).toBe(0);
    expect(computeRefund(P, { paidAmount: -5, startAt: inHours(100), now }).amount).toBe(0);
  });

  it('respects a custom policy', () => {
    const custom = { ...P, fullRefundHours: 72, partialRefundPercent: 50 };
    expect(computeRefund(custom, { paidAmount: 60_000, startAt: inHours(60), now })).toMatchObject({ tier: 'PARTIAL', amount: 30_000 });
  });
});

describe('manual refund override', () => {
  it('is clamped between 0 and the paid amount', () => {
    expect(clampRefundOverride(15_000, 40_000)).toBe(15_000);
    expect(clampRefundOverride(50_000, 40_000)).toBe(40_000);
    expect(clampRefundOverride(-1, 40_000)).toBe(0);
    expect(clampRefundOverride(Number.NaN, 40_000)).toBe(0);
  });
});

describe('canRescheduleFree', () => {
  it('allows one free reschedule more than 24h before', () => {
    expect(canRescheduleFree(P, { rescheduleCount: 0, startAt: inHours(25), now })).toEqual({ allowed: true });
  });
  it('rejects at 24h or later', () => {
    expect(canRescheduleFree(P, { rescheduleCount: 0, startAt: inHours(24), now })).toEqual({ allowed: false, reason: 'TOO_LATE' });
  });
  it('rejects the second reschedule', () => {
    expect(canRescheduleFree(P, { rescheduleCount: 1, startAt: inHours(100), now })).toEqual({ allowed: false, reason: 'LIMIT_REACHED' });
  });
});

describe('policy schema', () => {
  it('rejects partial threshold above full threshold', () => {
    expect(cancellationPolicySchema.safeParse({ ...P, partialRefundHours: 72 }).success).toBe(false);
  });
  it('rejects percentages over 100 and non-integers', () => {
    expect(cancellationPolicySchema.safeParse({ ...P, partialRefundPercent: 120 }).success).toBe(false);
    expect(cancellationPolicySchema.safeParse({ ...P, fullRefundHours: 1.5 }).success).toBe(false);
  });
});

describe('policy texts', () => {
  it('describes the default rules in Russian', () => {
    const t = policyTexts(P, 'ru');
    expect(t.full).toBe('Отмена более чем за 48 часов до съёмки — полный возврат.');
    expect(t.partial).toBe('Отмена за 24–48 часов — возврат 80%.');
    expect(t.none).toBe('Отмена менее чем за 24 часа — без возврата.');
    expect(t.reschedule).toBe('Один бесплатный перенос — при запросе более чем за 24 часа до съёмки.');
  });
  it('describes the default rules in Kazakh', () => {
    const t = policyTexts(P, 'kk');
    expect(t.summary).toContain('48');
    expect(t.summary).toContain('80%');
    expect(t.summary).toContain('24');
  });
  it('follows configured values', () => {
    const t = policyTexts({ ...P, fullRefundHours: 72, partialRefundPercent: 50, freeReschedules: 0 }, 'ru');
    expect(t.full).toContain('72 часа');
    expect(t.partial).toContain('50%');
    expect(t.reschedule).toBe('Бесплатный перенос не предусмотрен.');
  });
});
