'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';

export function TourSection() {
  const { t } = useLanguage();
  return (
    <section className="py-20 md:py-32 bg-black relative overflow-hidden" aria-labelledby="tour-title">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="container-max relative z-10">
        <div className="max-w-2xl mx-auto text-center text-white">
          <h2 id="tour-title" className="mb-6 text-white">
            {t('tour.title')}
          </h2>
          <p className="text-lg mb-10 text-white/85 leading-relaxed">{t('tour.subtitle')}</p>
          <Link href="/studio-tour" className="btn-primary">
            {t('tour.button')}
          </Link>
        </div>
      </div>
    </section>
  );
}
