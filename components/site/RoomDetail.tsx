'use client';

import Link from 'next/link';
import { formatPrice, useCatalog } from '@/components/CatalogContext';
import { ImageSlider } from '@/components/ImageSlider';
import { useLanguage } from '@/components/LanguageContext';
import { roomContent } from '@/lib/rooms-content';

export function RoomDetail({ slug }: { slug: string }) {
  const { language, t } = useLanguage();
  const catalog = useCatalog();
  const room = roomContent(slug)!;
  const capacity = catalog.rooms.find((r) => r.slug === room.slug)?.capacity ?? room.fallbackCapacity;
  const title = t(room.titleKey);

  return (
    <div className="pt-20">
      <section className="py-12 md:py-24 bg-bg-light">
        <div className="container-max">
          <nav aria-label="breadcrumbs" className="text-sm text-text-secondary mb-4">
            <Link href="/rooms" className="hover:text-orange-accent">
              ← {t('roomsPage.title')}
            </Link>
          </nav>
          <h1 className="mb-4">{title}</h1>
          <p className="text-lg md:text-xl text-text-secondary mb-10 md:mb-12 max-w-3xl">{t(room.descKey)}</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-start">
            <ImageSlider images={room.images} alt={title} className="h-80 md:h-[28rem] shadow-lg" priority />

            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-6 text-text-primary">{t('roomsDescriptions.information')}</h2>
              <dl className="space-y-5">
                <div>
                  <dt className="font-semibold text-text-primary mb-1">{t('roomsDescriptions.capacity')}</dt>
                  <dd className="text-orange-accent font-semibold text-lg">{t('roomsDescriptions.upTo').replace('{n}', String(capacity))}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-text-primary mb-1">{t('roomsDescriptions.roomSize')}</dt>
                  <dd className="text-text-secondary">{room.size}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-text-primary mb-2">{t('roomsPage.features')}</dt>
                  <dd>
                    <ul className="space-y-1 text-text-secondary">
                      {room.featureKeys.map((key) => (
                        <li key={key}>✓ {t(key)}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
                {catalog.services.length > 0 && (
                  <div>
                    <dt className="font-semibold text-text-primary mb-2">{t('roomsDescriptions.availablePackages')}</dt>
                    <dd>
                      <ul className="space-y-2 text-text-secondary">
                        {catalog.services.map((service) => (
                          <li key={service.slug} className="flex flex-wrap justify-between gap-x-4 border-b border-border-light pb-2">
                            <Link href={`/book?service=${service.slug}&room=${room.slug}`} className="hover:text-orange-accent">
                              {language === 'kk' ? service.nameKk : service.nameRu}
                            </Link>
                            <span className="font-semibold text-text-primary whitespace-nowrap">
                              {t('roomsDescriptions.fromPrice').replace('{price}', formatPrice(service.basePrice))} ·{' '}
                              {t('common.minutesShort').replace('{n}', String(service.defaultDuration))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>

              <div className="pt-8">
                <Link href={`/book?room=${room.slug}`} className="btn-primary w-full sm:w-auto">
                  {t('roomsDescriptions.bookRecording')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
