'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCatalog } from './CatalogContext';
import { useLanguage } from './LanguageContext';
import { useDocumentTitle } from './useDocumentTitle';
import { phoneHref } from '@/lib/contacts';
import { pageTitle } from '@/lib/page-titles';

const NAV = [
  { href: '/rooms', key: 'header.rooms' },
  { href: '/pricing', key: 'header.pricing' },
  { href: '/#how-it-works', key: 'header.process' },
  { href: '/studio-tour', key: 'header.tour' },
  { href: '/contacts', key: 'header.contacts' },
] as const;

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { contacts } = useCatalog();
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();

  // Close the mobile menu after navigation and on Escape.
  useEffect(() => setMobileMenuOpen(false), [pathname]);
  // Server HTML is Russian; the tab title follows the chosen language.
  useDocumentTitle(pageTitle(pathname, language));
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const isActive = (href: string) => !href.includes('#') && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="fixed top-0 left-0 right-0 bg-black z-50">
      <a href="#main" className="skip-link">
        {t('common.skipToContent')}
      </a>
      <div className="bg-brand-gradient text-on-brand">
        <div className="container-max flex h-9 items-center justify-center">
          <a
            href={phoneHref(contacts.phone)}
            className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold leading-none hover:underline"
            aria-label={`${t('header.callUs')}: ${contacts.phone}`}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z" />
            </svg>
            <span>{t('header.callUs')}</span>
            <span className="whitespace-nowrap">{contacts.phone}</span>
          </a>
        </div>
      </div>
      <div className="container-max">
        <div className="flex items-center justify-between h-20 gap-3">
          <Link href="/" className="flex items-center gap-3 min-h-[44px]" aria-label={t('header.home')}>
            <span className="w-9 h-9 bg-brand-gradient rounded-lg flex items-center justify-center" aria-hidden="true">
              <span className="text-white font-bold text-lg">◉</span>
            </span>
            <span className="hidden sm:inline font-bold text-white text-sm">SHYMKENT STUDIO</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8" aria-label={t('header.mainNav')}>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`text-sm transition ${isActive(item.href) ? 'text-white font-semibold' : 'text-gray-300 hover:text-white'}`}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-0.5 bg-gray-800 rounded-full p-1" role="group" aria-label={t('header.language')}>
              {(['ru', 'kk'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  lang={lang}
                  onClick={() => setLanguage(lang)}
                  aria-pressed={language === lang}
                  className={`min-w-[40px] min-h-[36px] px-3 text-xs font-semibold rounded-full transition ${
                    language === lang ? 'bg-brand-gradient text-on-brand' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {lang === 'ru' ? 'РУ' : 'ҚАЗ'}
                </button>
              ))}
            </div>

            <Link href="/book" className="btn-primary hidden sm:inline-flex text-sm !px-5 !py-2">
              {t('header.book')}
            </Link>
            <button
              type="button"
              className="lg:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-800 rounded-lg transition"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? t('header.closeMenu') : t('header.openMenu')}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <nav
          id="mobile-menu"
          hidden={!mobileMenuOpen}
          aria-label={t('header.mainNav')}
          className="lg:hidden pb-4 border-t border-gray-800 bg-black"
        >
          <ul className="pt-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={`flex items-center min-h-[44px] text-base border-l-2 pl-3 ${
                    isActive(item.href) ? 'border-brand text-white font-semibold' : 'border-transparent text-gray-200 hover:text-white'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/book" className="btn-primary w-full mt-3 text-sm" onClick={() => setMobileMenuOpen(false)}>
            {t('header.book')}
          </Link>
        </nav>
      </div>
    </header>
  );
}
