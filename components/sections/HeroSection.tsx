'use client';

import Link from 'next/link';
import { VideoWave } from '@/components/VideoWave';
import { useLanguage } from '@/components/LanguageContext';

export function HeroSection() {
  const { t } = useLanguage();
  return (
    <section className="py-20 md:py-48 bg-black relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <VideoWave />
      </div>

      <div className="container-max relative z-10 flex flex-col items-center justify-center text-center">
        <p className="inline-block mb-8 px-4 py-2 bg-orange-bright/15 rounded-full text-orange-bright font-semibold text-sm">SHYMKENT STUDIO</p>

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
      </div>
    </section>
  );
}
