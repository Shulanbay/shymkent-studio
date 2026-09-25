'use client';

import Link from 'next/link';
import { useCatalog } from '@/components/CatalogContext';
import { useLanguage } from '@/components/LanguageContext';
import { addressFor, phoneHref } from '@/lib/contacts';

export function Footer() {
  const { contacts } = useCatalog();
  const { language, t } = useLanguage();
  const currentYear = new Date().getFullYear();
  const address = addressFor(contacts, language);

  const linkClass = 'inline-flex min-h-[32px] items-center hover:text-white transition';

  return (
    <footer className="bg-black py-16">
      <div className="container-max">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-12 mb-12">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4" aria-label={t('header.home')}>
              <span className="w-8 h-8 bg-orange-bright rounded-lg flex items-center justify-center" aria-hidden="true">
                <span className="text-white font-bold text-sm">◉</span>
              </span>
              <span className="font-bold text-white text-sm">{contacts.studioName}</span>
            </Link>
            <p className="text-sm text-gray-400">{t('footer.description')}</p>
          </div>

          <nav aria-label={t('footer.siteTitle')}>
            <h2 className="font-semibold mb-4 text-sm text-white">{t('footer.siteTitle')}</h2>
            <ul className="space-y-1 text-sm text-gray-400">
              <li>
                <Link href="/rooms" className={linkClass}>
                  {t('footer.rooms')}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className={linkClass}>
                  {t('footer.pricing')}
                </Link>
              </li>
              <li>
                <Link href="/studio-tour" className={linkClass}>
                  {t('footer.tour')}
                </Link>
              </li>
              <li>
                <Link href="/book" className={linkClass}>
                  {t('footer.book')}
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="font-semibold mb-4 text-sm text-white">{t('footer.contactsTitle')}</h2>
            <ul className="space-y-1 text-sm text-gray-400">
              <li>
                <a href={phoneHref(contacts.phone)} className={linkClass}>
                  {contacts.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${contacts.email}`} className={`${linkClass} break-all`}>
                  {contacts.email}
                </a>
              </li>
              {contacts.instagram && (
                <li>
                  <a href={`https://instagram.com/${contacts.instagram}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    @{contacts.instagram}
                    <span className="sr-only"> {t('common.opensInNewTab')}</span>
                  </a>
                </li>
              )}
              {address && (
                <li className="pt-1">
                  {contacts.mapUrl ? (
                    <a href={contacts.mapUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                      {address}
                      <span className="sr-only"> {t('common.opensInNewTab')}</span>
                    </a>
                  ) : (
                    address
                  )}
                </li>
              )}
            </ul>
          </div>

          <nav aria-label={t('footer.docsTitle')}>
            <h2 className="font-semibold mb-4 text-sm text-white">{t('footer.docsTitle')}</h2>
            <ul className="space-y-1 text-sm text-gray-400">
              <li>
                <Link href="/privacy" className={linkClass}>
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <Link href="/contacts" className={linkClass}>
                  {t('header.contacts')}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="pt-8 border-t border-gray-900">
          <p className="text-center text-xs text-gray-400">
            {t('footer.copyright').replace('{year}', String(currentYear)).replace('SHYMKENT STUDIO', contacts.studioName)}
          </p>
        </div>
      </div>
    </footer>
  );
}
