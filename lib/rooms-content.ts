// Presentation content of the rooms (photos, size, texts). Capacity, names used
// in bookings and prices live in the catalog (CRM); this file only adds media.

export interface RoomContent {
  slug: 'small' | 'large' | 'lounge';
  titleKey: string;
  descKey: string;
  size: string;
  images: string[];
  featureKeys: string[];
  /** Used when the catalog is unavailable. */
  fallbackCapacity: number;
}

export const ROOM_CONTENT: RoomContent[] = [
  {
    slug: 'small',
    titleKey: 'roomsDescriptions.smallTitle',
    descKey: 'roomsDescriptions.smallDesc',
    size: '3 × 4 м',
    images: ['/images/rooms/small.jpg', '/images/rooms/small2.jpg', '/images/rooms/small3.jpg', '/images/rooms/small4.jpg'],
    featureKeys: ['roomsPage.small.f1', 'roomsPage.small.f2', 'roomsPage.small.f3'],
    fallbackCapacity: 2,
  },
  {
    slug: 'large',
    titleKey: 'roomsDescriptions.largeTitle',
    descKey: 'roomsDescriptions.largeDesc',
    size: '3 × 6 м',
    images: ['/images/rooms/large.jpg', '/images/rooms/large2.jpg', '/images/rooms/large3.jpg', '/images/rooms/large4.jpg'],
    featureKeys: ['roomsPage.large.f1', 'roomsPage.large.f2', 'roomsPage.large.f3'],
    fallbackCapacity: 4,
  },
  {
    slug: 'lounge',
    titleKey: 'roomsDescriptions.loungeTitle',
    descKey: 'roomsDescriptions.loungeDesc',
    size: '3 × 5 м',
    images: ['/images/rooms/lounge.jpg'],
    featureKeys: ['roomsPage.lounge.f1', 'roomsPage.lounge.f2', 'roomsPage.lounge.f3'],
    fallbackCapacity: 3,
  },
];

export const ROOM_META: Record<RoomContent['slug'], { description: string }> = {
  small: {
    description: 'Комната 3 × 4 м для интервью один на один и дуэтов: камеры Sony FX30, микрофоны Shure SM7B, студийный свет.',
  },
  large: {
    description: 'Студия 3 × 6 м для групповых подкастов до 4 человек: большой стол, камеры Sony FX30, микрофоны Shure SM7B.',
  },
  lounge: {
    description: 'Living Room 3 × 5 м с круглым мраморным столом для живого разговора до 3 человек.',
  },
};

export function roomContent(slug: string): RoomContent | undefined {
  return ROOM_CONTENT.find((r) => r.slug === slug);
}
