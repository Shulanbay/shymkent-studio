'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export function TourSection() {
  const { language } = useLanguage();
  return (
    <section className="py-20 md:py-32 bg-gradient-to-r from-orange-accent to-orange-light relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
      </div>

      <div className="container-max relative z-10">
        <div className="max-w-2xl mx-auto text-center text-white">
          <h2 className="mb-6 text-white">{getTranslation(language, 'tour.title')}</h2>

          <p className="text-lg mb-10 text-white/95 leading-relaxed">
            {getTranslation(language, 'tour.subtitle')}
          </p>

          <Link href="/studio-tour" className="inline-block px-8 py-4 bg-white text-orange-accent rounded-lg font-semibold hover:bg-bg-light transition-colors">
            {getTranslation(language, 'tour.button')}
          </Link>
        </div>
      </div>
    </section>
  );
}
