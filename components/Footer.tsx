'use client';

import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-text-primary text-white py-12">
      <div className="container-max">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold mb-4">SHYMKENT STUDIO</h3>
            <p className="text-sm text-gray-400">Подкаст-студия в Шымкенте</p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Навигация</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/rooms" className="hover:text-white transition">
                  Комнаты
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition">
                  Цены
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-white transition">
                  Бронирование
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Контакты</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a href="tel:+77005030501" className="hover:text-white transition">
                  +7 700 503 05 01
                </a>
              </li>
              <li>
                <a href="mailto:salem@shymkent.studio" className="hover:text-white transition">
                  salem@shymkent.studio
                </a>
              </li>
              <li>
                <a href="https://instagram.com/shymkent.studio" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                  Instagram
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Информация</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/privacy" className="hover:text-white transition">
                  Политика конфиденциальности
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition">
                  Условия бронирования
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-8">
          <p className="text-center text-sm text-gray-400">
            © {currentYear} SHYMKENT STUDIO. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
}
