'use client';

import Link from 'next/link';
import { VideoWave } from '@/components/VideoWave';
import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export function HeroSection() {
  const { language } = useLanguage();
  return (
    <section className="py-20 md:py-48 bg-black relative overflow-hidden">
      {/* Dark background for video wave effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-black pointer-events-none"></div>

      {/* Animated video wave background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <VideoWave />
      </div>

      <div className="container-max relative z-10 flex flex-col items-center justify-center text-center">
        <div className="inline-block mb-8 px-4 py-2 bg-orange-accent/10 rounded-full text-orange-accent font-semibold text-sm">
          SHYMKENT STUDIO
        </div>

        <h1 className="mb-8 text-white leading-tight max-w-3xl">
          {getTranslation(language, 'hero.title')}
        </h1>

        <p className="text-lg text-white/80 mb-16 leading-relaxed max-w-2xl">
          {getTranslation(language, 'hero.description')}
        </p>

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
    </section>
  );
}
