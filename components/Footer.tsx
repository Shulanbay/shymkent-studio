'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { language } = useLanguage();

  return (
    <footer className="bg-black py-16">
      <div className="container-max">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-orange-accent rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">◉</span>
              </div>
              <span className="font-bold text-white text-sm">SHYMKENT</span>
            </Link>
            <p className="text-xs text-gray-400">{getTranslation(language, 'footer.description')}</p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm text-white">Сайт</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <Link href="/#rooms" className="hover:text-white transition">
                  Студии
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:text-white transition">
                  Цены
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-white transition">
                  Забронировать
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm text-white">Контакты</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <a href="tel:+77005030501" className="hover:text-white transition">
                  +7 700 503 0501
                </a>
              </li>
              <li>
                <a href="mailto:salem@shymkent.studio" className="hover:text-white transition break-all">
                  salem@shymkent.studio
                </a>
              </li>
              <li>
                <a href="https://instagram.com/shymkent.studio" target="_blank" rel="noopener noreferrer" className="hover:text-orange-accent transition">
                  @shymkent.studio
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm text-white">Документы</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <Link href="/privacy" className="hover:text-white transition">
                  Конфиденциальность
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition">
                  Условия услуг
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8">
          <p className="text-center text-xs text-gray-400">
            © {currentYear} SHYMKENT STUDIO. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
}
