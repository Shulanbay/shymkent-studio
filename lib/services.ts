// Canonical tariff identifiers. Prices, durations and names live in the
// database (seeded from lib/catalog-defaults.ts, editable in the CRM).
// Legacy identifiers from earlier versions of the booking form are accepted
// as aliases so old links and payloads keep working.

export const SERVICE_SLUGS = ['starter', 'pro', 'premium'] as const;
export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

const LEGACY_ALIASES: Record<string, ServiceSlug> = {
  recording: 'starter',
  release: 'pro',
  editing: 'pro',
  full: 'premium',
};

export function normalizeServiceSlug(value: unknown): ServiceSlug | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  if ((SERVICE_SLUGS as readonly string[]).includes(key)) return key as ServiceSlug;
  return LEGACY_ALIASES[key] ?? null;
}
