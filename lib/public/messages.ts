// Error codes returned by public APIs and their messages (RU / KK).
// Messages never contain internal details.

export type PublicLang = 'ru' | 'kk';

export type PublicErrorCode =
  | 'VALIDATION'
  | 'INVALID_PHONE'
  | 'SERVICE_UNAVAILABLE'
  | 'ROOM_UNAVAILABLE'
  | 'CAPACITY'
  | 'INVALID_DURATION'
  | 'INVALID_DATE'
  | 'PAST'
  | 'TOO_SOON'
  | 'TOO_FAR'
  | 'CLOSED'
  | 'OUTSIDE_HOURS'
  | 'OFF_GRID'
  | 'SLOT_TAKEN'
  | 'RATE_LIMITED'
  | 'REJECTED'
  | 'FORBIDDEN'
  | 'SERVER';

const MESSAGES: Record<PublicErrorCode, Record<PublicLang, string>> = {
  VALIDATION: { ru: 'Проверьте, что форма заполнена правильно.', kk: 'Форманың дұрыс толтырылғанын тексеріңіз.' },
  INVALID_PHONE: {
    ru: 'Укажите номер телефона в формате +7 700 123 45 67.',
    kk: 'Телефон нөмірін +7 700 123 45 67 форматында енгізіңіз.',
  },
  SERVICE_UNAVAILABLE: { ru: 'Этот тариф сейчас недоступен.', kk: 'Бұл тариф қазір қолжетімсіз.' },
  ROOM_UNAVAILABLE: { ru: 'Эта комната сейчас недоступна.', kk: 'Бұл бөлме қазір қолжетімсіз.' },
  CAPACITY: {
    ru: 'В выбранной комнате не поместится столько участников.',
    kk: 'Таңдалған бөлмеге мұнша қатысушы сыймайды.',
  },
  INVALID_DURATION: {
    ru: 'Выбранная длительность недоступна для этого тарифа.',
    kk: 'Бұл тариф үшін таңдалған ұзақтық қолжетімсіз.',
  },
  INVALID_DATE: { ru: 'Некорректная дата.', kk: 'Күн дұрыс емес.' },
  PAST: { ru: 'Это время уже прошло. Выберите другое.', kk: 'Бұл уақыт өтіп кетті. Басқасын таңдаңыз.' },
  TOO_SOON: {
    ru: 'На это время уже нельзя записаться онлайн. Выберите более позднее время.',
    kk: 'Бұл уақытқа онлайн жазылу мүмкін емес. Кейінірек уақытты таңдаңыз.',
  },
  TOO_FAR: { ru: 'На эту дату онлайн-запись ещё не открыта.', kk: 'Бұл күнге онлайн жазылу әлі ашылмаған.' },
  CLOSED: { ru: 'В этот день студия не работает.', kk: 'Бұл күні студия жұмыс істемейді.' },
  OUTSIDE_HOURS: { ru: 'Выберите время из списка доступных.', kk: 'Қолжетімді уақыттар тізімінен таңдаңыз.' },
  OFF_GRID: { ru: 'Выберите время из списка доступных.', kk: 'Қолжетімді уақыттар тізімінен таңдаңыз.' },
  SLOT_TAKEN: {
    ru: 'Это время только что заняли. Пожалуйста, выберите другое.',
    kk: 'Бұл уақыт жаңа ғана брондалды. Басқа уақытты таңдаңыз.',
  },
  RATE_LIMITED: {
    ru: 'Слишком много заявок подряд. Попробуйте через несколько минут.',
    kk: 'Өтінімдер тым көп. Бірнеше минуттан кейін қайталаңыз.',
  },
  REJECTED: {
    ru: 'Не удалось отправить заявку. Обновите страницу и попробуйте снова.',
    kk: 'Өтінім жіберілмеді. Бетті жаңартып, қайталап көріңіз.',
  },
  FORBIDDEN: {
    ru: 'Не удалось отправить заявку. Обновите страницу и попробуйте снова.',
    kk: 'Өтінім жіберілмеді. Бетті жаңартып, қайталап көріңіз.',
  },
  SERVER: {
    ru: 'Не удалось сохранить заявку. Попробуйте ещё раз или напишите нам в WhatsApp.',
    kk: 'Өтінім сақталмады. Қайталап көріңіз немесе бізге WhatsApp арқылы жазыңыз.',
  },
};

export function publicMessage(code: PublicErrorCode, lang: PublicLang): string {
  return MESSAGES[code][lang] ?? MESSAGES[code].ru;
}

export function pickLang(value: unknown): PublicLang {
  return value === 'kk' ? 'kk' : 'ru';
}

export const HTTP_STATUS: Record<PublicErrorCode, number> = {
  VALIDATION: 422,
  INVALID_PHONE: 422,
  SERVICE_UNAVAILABLE: 422,
  ROOM_UNAVAILABLE: 422,
  CAPACITY: 422,
  INVALID_DURATION: 422,
  INVALID_DATE: 422,
  PAST: 422,
  TOO_SOON: 422,
  TOO_FAR: 422,
  CLOSED: 422,
  OUTSIDE_HOURS: 422,
  OFF_GRID: 422,
  SLOT_TAKEN: 409,
  RATE_LIMITED: 429,
  REJECTED: 400,
  FORBIDDEN: 403,
  SERVER: 500,
};
