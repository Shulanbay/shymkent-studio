'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';

export function NotFoundContent() {
  const { t } = useLanguage();
  return (
    <div className="pt-20">
      <section className="py-24 md:py-32 bg-bg-light">
        <div className="container-max text-center max-w-xl">
          <p className="text-6xl font-bold text-orange-accent mb-6" aria-hidden="true">
            404
          </p>
          <h1 className="text-3xl sm:text-4xl mb-4">{t('notFound.title')}</h1>
          <p className="text-text-secondary mb-10">{t('notFound.text')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/" className="btn-primary">
              {t('notFound.home')}
            </Link>
            <Link href="/book" className="btn-secondary">
              {t('notFound.book')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
