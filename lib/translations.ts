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

export function getTranslation(lang: Language, path: string) {
  const keys = path.split('.');
  let current: any = translations[lang] || translations.ru;

  for (const key of keys) {
    current = current?.[key];
    if (!current) return path;
  }

  return current;
}
