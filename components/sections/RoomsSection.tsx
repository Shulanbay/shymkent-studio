'use client';

import Link from 'next/link';
import { ImageSlider } from '@/components/ImageSlider';
import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

const rooms = [
  {
    id: 'small',
    titleKey: 'roomsDescriptions.smallTitle',
    capacityKey: 'rooms.capacitySmall',
    sizeKey: 'rooms.sizeSmall',
    descKey: 'roomsDescriptions.smallDesc',
    images: [
      '/images/rooms/small.jpg',
      '/images/rooms/small2.jpg',
      '/images/rooms/small3.jpg',
      '/images/rooms/small4.jpg',
    ],
    slug: 'small',
  },
  {
    id: 'large',
    titleKey: 'roomsDescriptions.largeTitle',
    capacityKey: 'rooms.capacityLarge',
    sizeKey: 'rooms.sizeLarge',
    descKey: 'roomsDescriptions.largeDesc',
    images: [
      '/images/rooms/large.jpg',
      '/images/rooms/large2.jpg',
      '/images/rooms/large3.jpg',
      '/images/rooms/large4.jpg',
    ],
    slug: 'large',
  },
  {
    id: 'lounge',
    titleKey: 'roomsDescriptions.loungeTitle',
    capacityKey: 'rooms.capacityLounge',
    sizeKey: 'rooms.sizeLounge',
    descKey: 'roomsDescriptions.loungeDesc',
    images: ['/images/rooms/lounge.jpg'],
    slug: 'lounge',
  },
];

export function RoomsSection() {
  const { language } = useLanguage();

  return (
    <section id="rooms" className="py-20 md:py-32 bg-white">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">{getTranslation(language, 'rooms.title')}</h2>
          <p className="text-lg text-text-secondary">{getTranslation(language, 'rooms.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {rooms.map((room) => (
            <Link key={room.id} href={`/rooms/${room.slug}`}>
              <div className="group cursor-pointer">
                <div className="mb-6 shadow-sm group-hover:shadow-lg transition-all duration-300">
                  <ImageSlider
                    images={room.images}
                    alt={getTranslation(language, room.titleKey)}
                    className="h-64 rounded-2xl"
                  />
                </div>

                <h3 className="text-xl font-bold mb-2 text-text-primary">{getTranslation(language, room.titleKey)}</h3>

                <div className="mb-4 flex items-center gap-4 text-sm">
                  <span className="text-orange-accent font-semibold">{getTranslation(language, room.capacityKey)}</span>
                  <span className="text-text-secondary">{getTranslation(language, room.sizeKey)}</span>
                </div>

                <p className="text-text-secondary mb-6 line-clamp-2">{getTranslation(language, room.descKey)}</p>

                <div className="inline-flex items-center gap-2 text-orange-accent font-semibold hover:gap-3 transition-all">
                  {getTranslation(language, 'rooms.moreInfo')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
