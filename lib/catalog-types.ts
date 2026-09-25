// Catalog data exposed to the public site (no internal fields).

export interface PublicService {
  slug: string;
  nameRu: string;
  nameKk: string;
  descriptionRu: string;
  descriptionKk: string;
  basePrice: number;
  defaultDuration: number;
  maxDuration: number;
  extraStepMinutes: number | null;
  extraStepPrice: number | null;
}

export interface PublicRoom {
  slug: string;
  nameRu: string;
  nameKk: string;
  capacity: number;
}

import type { StudioContacts } from '@/lib/settings-schema';

export interface PublicCatalog {
  /** false when the database was unreachable and defaults are shown (online booking disabled). */
  live: boolean;
  services: PublicService[];
  rooms: PublicRoom[];
  maxAdvanceDays: number;
  tourDurationMinutes: number;
  contacts: StudioContacts;
  /** ISO weekday (1 = Monday) → open/close, closed days omitted. */
  openingHours: { day: number; opens: string; closes: string }[];
}
