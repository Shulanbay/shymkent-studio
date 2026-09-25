import { describe, expect, it } from 'vitest';
import { DEFAULT_SERVICES } from '@/lib/catalog-defaults';
import { computeBookingPrice, durationOptions } from '@/lib/pricing';

const service = (slug: string) => {
  const s = DEFAULT_SERVICES.find((x) => x.slug === slug)!;
  return { ...s, extraStepMinutes: s.extraStepMinutes ?? null, extraStepPrice: s.extraStepPrice ?? null };
};
const starter = service('starter');
const pro = service('pro');
const premium = service('premium');

describe('Starter pricing: 20 000 ₸ for 60 min, +10 000 ₸ per started 30 min', () => {
  it.each([
    [60, 20_000, 0],
    [61, 30_000, 1],
    [89, 30_000, 1],
    [90, 30_000, 1],
    [91, 40_000, 2],
    [119, 40_000, 2],
    [120, 40_000, 2],
  ])('%i min → %i ₸', (minutes, total, steps) => {
    expect(computeBookingPrice(starter, minutes)).toEqual({ ok: true, total, durationMinutes: minutes, extraSteps: steps });
  });

  it.each([59, 121, 0, -30, 60.5])('%s min is rejected', (minutes) => {
    expect(computeBookingPrice(starter, minutes)).toEqual({ ok: false, error: 'INVALID_DURATION' });
  });

  it('offers 60 / 90 / 120 minutes in the form', () => {
    expect(durationOptions(starter)).toEqual([60, 90, 120]);
  });
});

describe('fixed tariffs', () => {
  it('Pro is 40 000 ₸ for 90 minutes only', () => {
    expect(computeBookingPrice(pro, 90)).toMatchObject({ ok: true, total: 40_000 });
    expect(computeBookingPrice(pro, 60).ok).toBe(false);
    expect(computeBookingPrice(pro, 120).ok).toBe(false);
    expect(durationOptions(pro)).toEqual([90]);
  });
  it('Premium is 60 000 ₸ for 90 minutes only', () => {
    expect(computeBookingPrice(premium, 90)).toMatchObject({ ok: true, total: 60_000 });
    expect(computeBookingPrice(premium, 91).ok).toBe(false);
  });
});

describe('catalog matches the published prices', () => {
  it('has the three tariffs at 20 000 / 40 000 / 60 000 ₸', () => {
    expect(DEFAULT_SERVICES.map((s) => [s.slug, s.basePrice])).toEqual([
      ['starter', 20_000],
      ['pro', 40_000],
      ['premium', 60_000],
    ]);
  });
});
