// Page titles of the public site in both languages. Pure module — the server
// metadata uses the Russian title, the header switches document.title when the
// visitor picks Kazakh (the site has one URL per page, see README «Язык и SEO»).

import type { Language } from '@/lib/translations';

export const SITE_NAME = 'SHYMKENT STUDIO';

export const PAGE_TITLES: Record<string, Record<Language, string>> = {
  '/': { ru: 'Подкаст- и видеостудия в Шымкенте — запись и монтаж', kk: 'Шымкенттегі подкаст және бейнестудия — жазба және монтаж' },
  '/rooms': { ru: 'Комнаты для записи подкастов в Шымкенте', kk: 'Шымкенттегі подкаст жазуға арналған бөлмелер' },
  '/rooms/small': { ru: 'Маленькая комната для подкаста в Шымкенте', kk: 'Шымкенттегі подкастқа арналған кіші бөлме' },
  '/rooms/large': { ru: 'Большая студия для подкаста в Шымкенте', kk: 'Шымкенттегі подкастқа арналған үлкен студия' },
  '/rooms/lounge': { ru: 'Living Room — студия для подкаста в Шымкенте', kk: 'Living Room — Шымкенттегі подкаст студиясы' },
  '/pricing': { ru: 'Цены на запись подкастов в Шымкенте', kk: 'Шымкентте подкаст жазу бағалары' },
  '/book': { ru: 'Забронировать запись подкаста', kk: 'Подкаст жазуға брондау' },
  '/studio-tour': { ru: 'Бесплатный тур по подкаст-студии', kk: 'Подкаст-студия бойынша тегін тур' },
  '/contacts': { ru: 'Контакты подкаст-студии в Шымкенте', kk: 'Шымкенттегі подкаст-студияның байланыс деректері' },
  '/terms': { ru: 'Условия бронирования и оплаты', kk: 'Брондау және төлем шарттары' },
  '/privacy': { ru: 'Политика конфиденциальности', kk: 'Құпиялылық саясаты' },
};

export const NOT_FOUND_TITLE: Record<Language, string> = { ru: 'Страница не найдена', kk: 'Бет табылмады' };

/** Full <title> for a known public path, or undefined. */
export function pageTitle(path: string, lang: Language): string | undefined {
  const titles = PAGE_TITLES[path];
  return titles ? `${titles[lang]} | ${SITE_NAME}` : undefined;
}
