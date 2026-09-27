'use client';

import Link from 'next/link';
import { useCatalog } from '@/components/CatalogContext';
import { ImageSlider } from '@/components/ImageSlider';
import { useLanguage } from '@/components/LanguageContext';
import { ROOM_CONTENT } from '@/lib/rooms-content';

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-brand-strong flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function RoomsList() {
  const { t } = useLanguage();
  const catalog = useCatalog();
  const rooms = ROOM_CONTENT.filter((room) => !catalog.live || catalog.rooms.some((r) => r.slug === room.slug));

  return (
    <div>
      <section className="py-12 md:py-24 bg-bg-light">
        <div className="container-max">
          <h1 className="mb-4">{t('roomsPage.title')}</h1>
          <p className="text-lg md:text-xl text-text-secondary mb-10 md:mb-12 max-w-3xl">{t('roomsPage.subtitle')}</p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {rooms.map((room, index) => {
              const capacity = catalog.rooms.find((r) => r.slug === room.slug)?.capacity ?? room.fallbackCapacity;
              const title = t(room.titleKey);
              return (
                <article key={room.slug} className="flex flex-col">
                  <ImageSlider images={room.images} alt={title} className="h-64 mb-6" priority={index === 0} />
                  <h2 className="text-2xl md:text-3xl font-bold mb-2 text-text-primary">
                    <Link href={`/rooms/${room.slug}`} className="hover:text-brand-ink">
                      {title}
                    </Link>
                  </h2>
                  <p className="mb-4 text-sm">
                    <span className="text-brand-ink font-semibold">{t('roomsDescriptions.upTo').replace('{n}', String(capacity))}</span>
                    <span className="text-text-secondary"> · {room.size}</span>
                  </p>
                  <p className="text-text-secondary mb-6 leading-relaxed">{t(room.descKey)}</p>
                  <h3 className="text-base font-semibold text-text-primary mb-3">{t('roomsPage.features')}</h3>
                  <ul className="space-y-2 mb-8 flex-grow">
                    {room.featureKeys.map((key) => (
                      <li key={key} className="flex items-start gap-3 text-text-secondary">
                        <CheckIcon />
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3">
                    <Link href={`/book?room=${room.slug}`} className="btn-primary text-center">
                      {t('roomsPage.bookInRoom')}
                    </Link>
                    <Link href={`/rooms/${room.slug}`} className="btn-secondary text-center">
                      {t('roomsPage.more')}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
