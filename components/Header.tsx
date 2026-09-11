'use client';

import Link from 'next/link';
import { useState } from 'react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur border-b border-border-light z-50">
      <div className="container-max">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">◉</span>
            </div>
            <span className="hidden sm:inline font-bold text-text-primary text-sm">SHYMKENT STUDIO</span>
          </Link>

          <nav className="hidden md:flex items-center gap-12">
            <Link href="/#rooms" className="text-sm text-text-secondary hover:text-text-primary transition">
              Студии
            </Link>
            <Link href="/#pricing" className="text-sm text-text-secondary hover:text-text-primary transition">
              Цены
            </Link>
            <Link href="/#how-it-works" className="text-sm text-text-secondary hover:text-text-primary transition">
              Процесс
            </Link>
            <Link href="/contacts" className="text-sm text-text-secondary hover:text-text-primary transition">
              Контакты
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/book" className="btn-primary hidden sm:block text-sm px-5 py-2">
              Забронировать
            </Link>
            <button
              className="md:hidden p-2 hover:bg-bg-light rounded-lg transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border-light bg-bg-light">
            <Link href="/#rooms" className="block py-2 text-sm text-text-secondary hover:text-text-primary">
              Студии
            </Link>
            <Link href="/#pricing" className="block py-2 text-sm text-text-secondary hover:text-text-primary">
              Цены
            </Link>
            <Link href="/#how-it-works" className="block py-2 text-sm text-text-secondary hover:text-text-primary">
              Процесс
            </Link>
            <Link href="/contacts" className="block py-2 text-sm text-text-secondary hover:text-text-primary">
              Контакты
            </Link>
            <Link href="/book" className="block py-3 mt-3 btn-primary text-center text-sm">
              Забронировать
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
