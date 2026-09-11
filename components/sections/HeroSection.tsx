'use client';

import Link from 'next/link';
import { RoomImage } from '@/components/RoomImage';
import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export function HeroSection() {
  const { language } = useLanguage();
  return (
    <section className="py-20 md:py-48 bg-white relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-accent/5 via-transparent to-transparent pointer-events-none"></div>

      <div className="container-max relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column */}
          <div>
            <div className="inline-block mb-8 px-4 py-2 bg-orange-accent/10 rounded-full text-orange-accent font-semibold text-sm">
              SHYMKENT STUDIO
            </div>

            <h1 className="mb-8 text-text-primary leading-tight">
              {getTranslation(language, 'hero.title')}
            </h1>

            <p className="text-lg text-text-secondary mb-8 leading-relaxed max-w-lg">
              {getTranslation(language, 'hero.description')}
            </p>

            {/* Price highlights */}
            <div className="grid grid-cols-2 gap-6 mb-12">
              <div className="bg-bg-light rounded-lg p-4">
                <p className="text-text-secondary text-sm mb-1">{getTranslation(language, 'hero.starter')}</p>
                <p className="text-3xl font-bold text-orange-accent">20 000 ₸</p>
              </div>
              <div className="bg-bg-light rounded-lg p-4">
                <p className="text-text-secondary text-sm mb-1">{getTranslation(language, 'hero.pro')}</p>
                <p className="text-3xl font-bold text-orange-accent">40 000 ₸</p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/book" className="btn-primary text-center">
                {getTranslation(language, 'hero.bookStudio')}
              </Link>
              <Link href="/studio-tour" className="btn-secondary text-center">
                {getTranslation(language, 'hero.freeTour')}
              </Link>
            </div>
          </div>

          {/* Right column - Hero image */}
          <div className="relative animate-float">
            <div className="relative h-96 md:h-full min-h-96 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow">
              <RoomImage src="/images/rooms/small4.jpg" alt="Подкаст-студия SHYMKENT STUDIO" className="h-full w-full object-cover" priority />
            </div>
            {/* Decorative accent - animated glow */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br from-orange-accent/20 to-orange-light/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
