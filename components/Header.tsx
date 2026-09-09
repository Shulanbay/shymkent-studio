'use client';

import Link from 'next/link';
import { useState } from 'react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 bg-bg-light border-b border-border-light z-50">
      <div className="container-max">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-text-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">S</span>
            </div>
            <span className="hidden sm:inline font-bold text-text-primary">SHYM STUDIO</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/rooms" className="text-text-secondary hover:text-text-primary transition">
              Комнаты
            </Link>
            <Link href="/pricing" className="text-text-secondary hover:text-text-primary transition">
              Цены
            </Link>
            <Link href="#how-it-works" className="text-text-secondary hover:text-text-primary transition">
              Как это работает
            </Link>
            <Link href="/contacts" className="text-text-secondary hover:text-text-primary transition">
              Контакты
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/book" className="btn-primary hidden sm:block">
              Забронировать
            </Link>
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border-light">
            <Link href="/rooms" className="block py-2 text-text-secondary hover:text-text-primary">
              Комнаты
            </Link>
            <Link href="/pricing" className="block py-2 text-text-secondary hover:text-text-primary">
              Цены
            </Link>
            <Link href="#how-it-works" className="block py-2 text-text-secondary hover:text-text-primary">
              Как это работает
            </Link>
            <Link href="/contacts" className="block py-2 text-text-secondary hover:text-text-primary">
              Контакты
            </Link>
            <Link href="/book" className="block py-3 mt-2 btn-primary text-center">
              Забронировать
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
