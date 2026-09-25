// Server-side price calculation. Pure module — the only place prices are computed.
// Prices come from the Service row (editable in the CRM); the browser never sends a price.

export interface PricedService {
  basePrice: number;
  /** Minutes included in basePrice. */
  defaultDuration: number;
  maxDuration: number;
  /** Extension step; null when the tariff has a fixed duration. */
  extraStepMinutes?: number | null;
  extraStepPrice?: number | null;
}

export type PriceResult =
  | { ok: true; total: number; durationMinutes: number; extraSteps: number }
  | { ok: false; error: 'INVALID_DURATION' };

export function canExtend(service: PricedService): boolean {
  return Boolean(service.extraStepMinutes && service.extraStepMinutes > 0 && service.extraStepPrice != null);
}

/**
 * Starter: 20 000 ₸ for 60 min, +10 000 ₸ for every started extra 30 min, up to maxDuration.
 * Pro / Premium: fixed duration and price.
 */
export function computeBookingPrice(service: PricedService, durationMinutes: number): PriceResult {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return { ok: false, error: 'INVALID_DURATION' };
  if (!canExtend(service)) {
    return durationMinutes === service.defaultDuration
      ? { ok: true, total: service.basePrice, durationMinutes, extraSteps: 0 }
      : { ok: false, error: 'INVALID_DURATION' };
  }
  if (durationMinutes < service.defaultDuration || durationMinutes > service.maxDuration) {
    return { ok: false, error: 'INVALID_DURATION' };
  }
  const extra = durationMinutes - service.defaultDuration;
  const extraSteps = Math.ceil(extra / service.extraStepMinutes!);
  return { ok: true, total: service.basePrice + extraSteps * service.extraStepPrice!, durationMinutes, extraSteps };
}

/** Durations offered in the booking form (base, base + step, … ≤ max). */
export function durationOptions(service: PricedService): number[] {
  if (!canExtend(service)) return [service.defaultDuration];
  const options: number[] = [];
  for (let d = service.defaultDuration; d <= service.maxDuration; d += service.extraStepMinutes!) options.push(d);
  return options;
}
