'use client';

import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export function BookingTitle() {
  const { language } = useLanguage();
  return <h1 className="mb-8 md:mb-12">{getTranslation(language, 'booking.title')}</h1>;
}
