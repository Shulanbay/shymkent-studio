'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLanguage } from './LanguageContext';
import { getTranslation } from '@/lib/translations';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, setLanguage } = useLanguage();

  return (
    <header className="fixed top-0 left-0 right-0 bg-black backdrop-blur z-50">
      <div className="container-max">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">◉</span>
            </div>
            <span className="hidden sm:inline font-bold text-white text-sm">SHYMKENT STUDIO</span>
          </Link>

          <nav className="hidden md:flex items-center gap-12">
            <Link href="/#rooms" className="text-sm text-gray-300 hover:text-white transition">
              {getTranslation(language, 'header.studios')}
            </Link>
            <Link href="/#pricing" className="text-sm text-gray-300 hover:text-white transition">
              {getTranslation(language, 'header.pricing')}
            </Link>
            <Link href="/#how-it-works" className="text-sm text-gray-300 hover:text-white transition">
              {getTranslation(language, 'header.process')}
            </Link>
            <Link href="/contacts" className="text-sm text-gray-300 hover:text-white transition">
              {getTranslation(language, 'header.contacts')}
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Language switcher */}
            <div className="flex items-center gap-0.5 bg-gray-800 rounded-full p-1">
              <button
                onClick={() => setLanguage('ru')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                  language === 'ru'
                    ? 'bg-orange-accent text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                РУ
              </button>
              <button
                onClick={() => setLanguage('kk')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                  language === 'kk'
                    ? 'bg-orange-accent text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                КК
              </button>
            </div>

            <Link href="/book" className="btn-primary hidden sm:block text-sm px-5 py-2">
              {getTranslation(language, 'header.book')}
            </Link>
            <button
              className="md:hidden p-2 hover:bg-gray-800 rounded-lg transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-gray-700 bg-black">
            <Link href="/#rooms" className="block py-2 text-sm text-gray-300 hover:text-white">
              {getTranslation(language, 'header.studios')}
            </Link>
            <Link href="/#pricing" className="block py-2 text-sm text-gray-300 hover:text-white">
              {getTranslation(language, 'header.pricing')}
            </Link>
            <Link href="/#how-it-works" className="block py-2 text-sm text-gray-300 hover:text-white">
              {getTranslation(language, 'header.process')}
            </Link>
            <Link href="/contacts" className="block py-2 text-sm text-gray-300 hover:text-white">
              {getTranslation(language, 'header.contacts')}
            </Link>
            <Link href="/book" className="block py-3 mt-3 btn-primary text-center text-sm">
              {getTranslation(language, 'header.book')}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
