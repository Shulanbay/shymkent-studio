// Presentation helpers for the studio contacts stored in CRM settings. Pure module.
import type { StudioContacts } from '@/lib/settings-schema';

type Lang = 'ru' | 'kk';

/** "Шымкент, ул. …" in the visitor's language (Kazakh address falls back to Russian). */
export function addressFor(contacts: Pick<StudioContacts, 'city' | 'address' | 'addressKk'>, lang: Lang): string {
  const street = (lang === 'kk' && contacts.addressKk) || contacts.address;
  return [contacts.city, street].filter(Boolean).join(', ');
}

/** tel: link from a display phone such as "+7 700 503 05 01". */
export function phoneHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `tel:+${digits.startsWith('8') && digits.length === 11 ? `7${digits.slice(1)}` : digits}`;
}

/** The opening notice is shown only while the configured date is still ahead (studio time). */
export function isBeforeOpening(openingDate: string, today: string): boolean {
  return Boolean(openingDate) && openingDate > today;
}

const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_KK = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];

/** "10 ноября 2026 года" / "2026 жылғы 10 қараша" for a YYYY-MM-DD date. */
export function formatLongDate(date: string, lang: Lang): string {
  const [y, m, d] = date.split('-').map(Number);
  return lang === 'kk' ? `${y} жылғы ${d} ${MONTHS_KK[m - 1]}` : `${d} ${MONTHS_RU[m - 1]} ${y} года`;
}
