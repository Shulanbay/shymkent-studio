// Initial catalog: the three studio rooms and the three published tariffs.
// Single source for the seed and for the public-site fallback when the
// database is unreachable. After seeding, the database (editable in the CRM)
// is the source of truth for prices and durations.

export interface CatalogRoom {
  slug: string;
  nameRu: string;
  nameKk: string;
  capacity: number;
  color: string;
  googleColorId: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  sortOrder: number;
}

export interface CatalogService {
  slug: string;
  nameRu: string;
  nameKk: string;
  descriptionRu: string;
  descriptionKk: string;
  basePrice: number;
  defaultDuration: number;
  maxDuration: number;
  extraStepMinutes?: number | null;
  extraStepPrice?: number | null;
  sortOrder: number;
}

export const DEFAULT_ROOMS: CatalogRoom[] = [
  {
    slug: 'large',
    nameRu: 'Большая студия',
    nameKk: 'Үлкен студия',
    capacity: 4,
    color: '#2563EB',
    googleColorId: '7',
    bufferBeforeMinutes: 15,
    bufferAfterMinutes: 15,
    sortOrder: 1,
  },
  {
    slug: 'small',
    nameRu: 'Маленькая комната',
    nameKk: 'Кіші бөлме',
    capacity: 2,
    color: '#F97316',
    googleColorId: '6',
    bufferBeforeMinutes: 15,
    bufferAfterMinutes: 15,
    sortOrder: 2,
  },
  {
    slug: 'lounge',
    nameRu: 'Living Room',
    nameKk: 'Living Room',
    capacity: 3,
    color: '#7C3AED',
    googleColorId: '3',
    bufferBeforeMinutes: 15,
    bufferAfterMinutes: 15,
    sortOrder: 3,
  },
];

// Prices and durations as published on /pricing.
export const DEFAULT_SERVICES: CatalogService[] = [
  {
    slug: 'starter',
    nameRu: 'Starter — только запись',
    nameKk: 'Starter — тек жазба',
    descriptionRu: '60 минут съёмки на 3 камеры, исходники через 24 часа',
    descriptionKk: '60 минут жазба 3 камерада, түпнұсқа 24 сағат ішінде',
    basePrice: 20000,
    defaultDuration: 60,
    maxDuration: 120,
    extraStepMinutes: 30,
    extraStepPrice: 10000,
    sortOrder: 1,
  },
  {
    slug: 'pro',
    nameRu: 'Pro — запись + монтаж',
    nameKk: 'Pro — жазба + монтаж',
    descriptionRu: 'До 90 минут + профессиональный монтаж + обработка звука',
    descriptionKk: '90 минутқа дейін + кәсіби монтаж + дыбыс өңдеу',
    basePrice: 40000,
    defaultDuration: 90,
    maxDuration: 90,
    sortOrder: 2,
  },
  {
    slug: 'premium',
    nameRu: 'Premium — запись + монтаж + Reels',
    nameKk: 'Premium — жазба + монтаж + Reels',
    descriptionRu: '90 минут + монтаж + контент для социальных сетей',
    descriptionKk: '90 минут + монтаж + әлеуметтік желілерге арналған контент',
    basePrice: 60000,
    defaultDuration: 90,
    maxDuration: 90,
    sortOrder: 3,
  },
];
