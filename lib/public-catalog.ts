import 'server-only';
import { unstable_cache } from 'next/cache';
import { DEFAULT_ROOMS, DEFAULT_SERVICES } from '@/lib/catalog-defaults';
import type { PublicCatalog } from '@/lib/catalog-types';
import { prisma } from '@/lib/db';
import { SETTINGS_CACHE_TAG } from '@/lib/public-settings';
import { DEFAULT_STUDIO_CONTACTS, DEFAULT_WORKING_HOURS, type WorkingHours } from '@/lib/settings-schema';
import { getStudioContacts, getWorkingHours } from '@/lib/settings';
import { log } from '@/lib/log';

export const CATALOG_CACHE_TAG = 'catalog';

function openingHoursOf(hours: WorkingHours) {
  return Object.entries(hours.days)
    .filter(([, h]) => h)
    .map(([day, h]) => ({ day: Number(day), opens: h!.open, closes: h!.close }));
}

const loadCatalog = unstable_cache(
  async (): Promise<PublicCatalog> => {
    const [services, rooms, hours, contacts] = await Promise.all([
      prisma.service.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.room.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      getWorkingHours(prisma),
      getStudioContacts(prisma),
    ]);
    return {
      live: true,
      services: services.map((s) => ({
        slug: s.slug,
        nameRu: s.nameRu,
        nameKk: s.nameKk,
        descriptionRu: s.descriptionRu,
        descriptionKk: s.descriptionKk,
        basePrice: s.basePrice,
        defaultDuration: s.defaultDuration,
        maxDuration: s.maxDuration,
        extraStepMinutes: s.extraStepMinutes,
        extraStepPrice: s.extraStepPrice,
      })),
      rooms: rooms.map((r) => ({ slug: r.slug, nameRu: r.nameRu, nameKk: r.nameKk, capacity: r.capacity })),
      maxAdvanceDays: hours.maxAdvanceDays,
      tourDurationMinutes: hours.tour.durationMinutes,
      contacts,
      openingHours: openingHoursOf(hours),
    };
  },
  ['public-catalog'],
  { tags: [CATALOG_CACHE_TAG, SETTINGS_CACHE_TAG], revalidate: 300 },
);

export const FALLBACK_CATALOG: PublicCatalog = {
  live: false,
  services: DEFAULT_SERVICES.map((s) => ({
    slug: s.slug,
    nameRu: s.nameRu,
    nameKk: s.nameKk,
    descriptionRu: s.descriptionRu,
    descriptionKk: s.descriptionKk,
    basePrice: s.basePrice,
    defaultDuration: s.defaultDuration,
    maxDuration: s.maxDuration,
    extraStepMinutes: s.extraStepMinutes ?? null,
    extraStepPrice: s.extraStepPrice ?? null,
  })),
  rooms: DEFAULT_ROOMS.map((r) => ({ slug: r.slug, nameRu: r.nameRu, nameKk: r.nameKk, capacity: r.capacity })),
  maxAdvanceDays: DEFAULT_WORKING_HOURS.maxAdvanceDays,
  tourDurationMinutes: DEFAULT_WORKING_HOURS.tour.durationMinutes,
  contacts: DEFAULT_STUDIO_CONTACTS,
  openingHours: openingHoursOf(DEFAULT_WORKING_HOURS),
};

/** Never throws: falls back to defaults (with online booking disabled) if the DB is unreachable. */
export async function getPublicCatalog(): Promise<PublicCatalog> {
  if (!process.env.DATABASE_URL) return FALLBACK_CATALOG;
  try {
    return await loadCatalog();
  } catch {
    log.warn('catalog.db_unavailable', { fallback: 'default catalog, online booking disabled' });
    return FALLBACK_CATALOG;
  }
}
