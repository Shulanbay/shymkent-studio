'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useCatalog } from '@/components/CatalogContext';
import { useLanguage } from '@/components/LanguageContext';

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();
  const { contacts } = useCatalog();
  useEffect(() => {
    // Only the digest: it matches the server log entry without exposing details.
    console.error('[site] render error', error.digest ?? '');
  }, [error]);
  return (
    <div>
      <section className="py-24 md:py-32 bg-bg-light">
        <div className="container-max text-center max-w-xl">
          <h1 className="text-3xl sm:text-4xl mb-4">{t('errorPage.title')}</h1>
          <p className="text-text-secondary mb-10">{t('errorPage.text')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={reset} className="btn-primary">
              {t('errorPage.retry')}
            </button>
            <a href={`https://wa.me/${contacts.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              WhatsApp
            </a>
            <Link href="/" className="btn-ghost">
              {t('notFound.home')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
