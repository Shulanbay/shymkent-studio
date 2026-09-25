'use client';

import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export function TourIntro() {
  const { language } = useLanguage();
  return (
    <>
      <h1 className="mb-4">{getTranslation(language, 'tourPage.title')}</h1>
      <p className="text-xl text-text-secondary mb-12">{getTranslation(language, 'tourPage.subtitle')}</p>
    </>
  );
}
