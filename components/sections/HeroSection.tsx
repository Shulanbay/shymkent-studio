'use client';

import Link from 'next/link';
import { formatPrice, useCatalog } from '@/components/CatalogContext';
import { VideoWave } from '@/components/VideoWave';
import { useLanguage } from '@/components/LanguageContext';

export function HeroSection() {
  const { t } = useLanguage();
  const { services } = useCatalog();
  const fromPrice = services.length ? Math.min(...services.map((s) => s.basePrice)) : null;
  return (
    <section className="py-20 md:py-48 bg-black relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <VideoWave />
      </div>

      <div className="container-max relative z-10 flex flex-col items-center justify-center text-center">
        <p className="inline-block mb-8 px-4 py-2 bg-brand/15 rounded-full text-brand-light font-semibold text-sm">{t('hero.eyebrow')}</p>

        <h1 className="mb-8 text-white leading-tight max-w-3xl">{t('hero.title')}</h1>

        <p className="text-lg text-white/85 mb-12 md:mb-16 leading-relaxed max-w-2xl">{t('hero.description')}</p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link href="/book" className="btn-primary text-center">
            {t('hero.bookStudio')}
          </Link>
          <Link href="/studio-tour" className="btn-secondary-dark text-center">
            {t('hero.freeTour')}
          </Link>
        </div>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/80">
          {fromPrice !== null && (
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
              {t('hero.priceFrom').replace('{price}', formatPrice(fromPrice))}
            </li>
          )}
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
            {t('hero.byAppointment')}
          </li>
        </ul>
      </div>
    </section>
  );
}
