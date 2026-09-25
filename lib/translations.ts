import ruTranslations from '@/public/translations/ru.json';
import kkTranslations from '@/public/translations/kk.json';

export type Language = 'ru' | 'kk';

const translations: Record<Language, typeof ruTranslations> = {
  ru: ruTranslations,
  kk: kkTranslations,
};

export function getTranslations(lang: Language) {
  return translations[lang] || translations.ru;
}

function lookup(tree: unknown, path: string): string | undefined {
  let current: unknown = tree;
  for (const key of path.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Text by dotted key. A key missing in Kazakh falls back to Russian, so a
 * visitor never sees a raw key (tests check both files have the same keys).
 */
export function getTranslation(lang: Language, path: string): string {
  return lookup(translations[lang] ?? translations.ru, path) ?? lookup(translations.ru, path) ?? path;
}
