'use client';

import Link from 'next/link';
import { useCatalog } from '@/components/CatalogContext';
import { ImageSlider } from '@/components/ImageSlider';
import { useLanguage } from '@/components/LanguageContext';
import { ROOM_CONTENT } from '@/lib/rooms-content';

export function RoomsSection() {
  const { t } = useLanguage();
  const catalog = useCatalog();
  const rooms = ROOM_CONTENT.filter((room) => !catalog.live || catalog.rooms.some((r) => r.slug === room.slug));

  return (
    <section id="rooms" className="py-20 md:py-32 bg-white" aria-labelledby="rooms-title">
      <div className="container-max">
        <div className="text-center mb-12 md:mb-16">
          <h2 id="rooms-title" className="mb-4 text-text-primary">
            {t('rooms.title')}
          </h2>
          <p className="text-lg text-text-secondary">{t('rooms.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {rooms.map((room) => {
            const capacity = catalog.rooms.find((r) => r.slug === room.slug)?.capacity ?? room.fallbackCapacity;
            const title = t(room.titleKey);
            return (
              <article key={room.slug}>
                <ImageSlider images={room.images} alt={title} className="h-64 mb-6 shadow-sm" sizes="(max-width: 768px) 100vw, 33vw" />
                <h3 className="text-xl font-bold mb-2 text-text-primary">
                  <Link href={`/rooms/${room.slug}`} className="hover:text-brand-ink">
                    {title}
                  </Link>
                </h3>
                <p className="mb-4 text-sm">
                  <span className="text-brand-ink font-semibold">{t('roomsDescriptions.upTo').replace('{n}', String(capacity))}</span>
                  <span className="text-text-secondary"> · {room.size}</span>
                </p>
                <p className="text-text-secondary mb-5">{t(room.descKey)}</p>
                <Link
                  href={`/rooms/${room.slug}`}
                  className="inline-flex items-center gap-2 min-h-[44px] text-brand-ink font-semibold hover:gap-3 transition-all"
                >
                  {t('rooms.moreInfo')}
                  <span className="sr-only">: {title}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
