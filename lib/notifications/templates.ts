// Email templates. Pure module: every user-supplied value is HTML-escaped,
// subjects are single-line, links must be http(s). Client emails use the
// client's language (RU / KK); studio contacts come from Settings.

import { addressFor } from '@/lib/contacts';
import { escapeHtml } from '@/lib/html';
import type { PolicyTexts } from '@/lib/policy';
import { DEFAULT_STUDIO_CONTACTS, type StudioContacts } from '@/lib/settings-schema';

export type Lang = 'ru' | 'kk';

export interface BookingEmailData {
  number: string;
  serviceName: string;
  roomName: string;
  date: string; // DD.MM.YYYY, studio time
  time: string; // HH:MM–HH:MM
  durationMinutes: number;
  participants: number;
  total: number;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  comment?: string | null;
  crmUrl: string;
}

export interface TourEmailData {
  number: string;
  date: string;
  time: string;
  format?: string | null;
  clientName: string;
  clientPhone: string;
  crmUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const money = (n: number) => `${n.toLocaleString('ru-RU').replace(/ /g, ' ')} ₸`;
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').slice(0, 200);
const safeUrl = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url) ? url : null);

function layout(body: string): string {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#171717;line-height:1.5">${body}<p style="color:#999;font-size:12px;margin-top:32px">SHYMKENT STUDIO</p></body></html>`;
}

type Rows = [string, string | number | null | undefined][];

function rows(items: Rows): string {
  return `<table cellpadding="4" style="border-collapse:collapse">${items
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<tr><td style="color:#65605B">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`)
    .join('')}</table>`;
}

function textRows(items: Rows): string {
  return items
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

// ─── Staff notifications ──────────────────────────────────────────────────────

export function bookingAdminEmail(d: BookingEmailData): RenderedEmail {
  const items: Rows = [
    ['Заказ', d.number],
    ['Тариф', d.serviceName],
    ['Комната', d.roomName],
    ['Дата', d.date],
    ['Время', d.time],
    ['Длительность', `${d.durationMinutes} мин`],
    ['Участников', d.participants],
    ['Сумма', money(d.total)],
    ['Клиент', d.clientName],
    ['Телефон', d.clientPhone],
    ['Email', d.clientEmail],
    ['Комментарий', d.comment],
  ];
  return {
    subject: oneLine(`Новая заявка ${d.number}: ${d.date} ${d.time}, ${d.roomName}`),
    html: layout(`<h2>Новая заявка на запись</h2>${rows(items)}<p><a href="${escapeHtml(d.crmUrl)}">Открыть заказ в CRM</a></p>`),
    text: `Новая заявка на запись\n\n${textRows(items)}\n\nCRM: ${d.crmUrl}`,
  };
}

export function tourAdminEmail(d: TourEmailData): RenderedEmail {
  const items: Rows = [
    ['Заявка', d.number],
    ['Дата', d.date],
    ['Время', d.time],
    ['Формат', d.format],
    ['Клиент', d.clientName],
    ['Телефон', d.clientPhone],
  ];
  return {
    subject: oneLine(`Заявка на тур ${d.number}: ${d.date} ${d.time}`),
    html: layout(`<h2>Новая заявка на бесплатный тур</h2>${rows(items)}<p><a href="${escapeHtml(d.crmUrl)}">Открыть в CRM</a></p>`),
    text: `Новая заявка на бесплатный тур\n\n${textRows(items)}\n\nCRM: ${d.crmUrl}`,
  };
}

// ─── Client lifecycle emails ──────────────────────────────────────────────────

export type ClientEmailKind =
  | 'received'
  | 'confirmed'
  | 'payment_link'
  | 'rescheduled'
  | 'cancelled'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'ready'
  | 'tour_confirmed'
  | 'tour_rescheduled'
  | 'tour_cancelled'
  | 'tour_reminder';

interface Copy {
  subject: string;
  title: string;
  intro: string;
  cta?: string;
}

type Vars = { n: string; date: string; time: string };

const COPY: Record<Lang, Record<ClientEmailKind, (v: Vars) => Copy>> = {
  ru: {
    received: (v) => ({
      subject: `Заявка ${v.n} получена — SHYMKENT STUDIO`,
      title: 'Мы получили вашу заявку',
      intro:
        'Спасибо за выбор SHYMKENT STUDIO. Это ещё не подтверждение: администратор проверит время и свяжется с вами, после чего пришлёт ссылку на оплату Kaspi (также возможен банковский перевод).',
    }),
    confirmed: (v) => ({
      subject: `Бронирование ${v.n} подтверждено`,
      title: 'Время закреплено за вами',
      intro: 'Ждём вас в SHYMKENT STUDIO. Если оплата ещё не внесена, ссылку на оплату пришлёт администратор.',
    }),
    payment_link: (v) => ({
      subject: `Ссылка на оплату заказа ${v.n}`,
      title: 'Оплата заказа',
      intro: 'Для оплаты перейдите по ссылке ниже. Можно также оплатить банковским переводом — реквизиты уточните у администратора.',
      cta: 'Оплатить',
    }),
    rescheduled: (v) => ({
      subject: `Бронирование ${v.n} перенесено`,
      title: 'Запись перенесена',
      intro: 'Мы перенесли вашу запись. Новые дата и время — ниже.',
    }),
    cancelled: (v) => ({
      subject: `Бронирование ${v.n} отменено`,
      title: 'Запись отменена',
      intro: 'Ваша запись отменена. Если это ошибка или вы хотите выбрать другое время — напишите нам.',
    }),
    reminder_24h: (v) => ({
      subject: `Напоминание: запись ${v.date} в ${v.time}`,
      title: 'Запись уже завтра',
      intro: 'Напоминаем о записи в SHYMKENT STUDIO. Пожалуйста, приходите за 10 минут до начала.',
    }),
    reminder_2h: (v) => ({
      subject: `Через 2 часа — ваша запись (${v.time})`,
      title: 'Скоро начинаем',
      intro: `Ждём вас сегодня в ${v.time}.`,
    }),
    ready: (v) => ({
      subject: `Заказ ${v.n} готов`,
      title: 'Материалы готовы',
      intro: 'Спасибо, что записывались у нас! Материалы можно скачать по ссылке ниже.',
      cta: 'Открыть материалы',
    }),
    tour_confirmed: (v) => ({
      subject: `Тур ${v.n} подтверждён`,
      title: 'Ждём вас на тур',
      intro: 'Ждём вас на бесплатный тур по студии.',
    }),
    tour_rescheduled: (v) => ({
      subject: `Тур ${v.n} перенесён`,
      title: 'Тур перенесён',
      intro: 'Мы перенесли ваш тур. Новые дата и время — ниже.',
    }),
    tour_cancelled: (v) => ({
      subject: `Тур ${v.n} отменён`,
      title: 'Тур отменён',
      intro: 'Ваш тур отменён. Если хотите выбрать другое время — напишите нам.',
    }),
    tour_reminder: (v) => ({
      subject: `Напоминание о туре: ${v.date} в ${v.time}`,
      title: 'Скоро ваш тур',
      intro: 'Напоминаем о бесплатном туре по SHYMKENT STUDIO.',
    }),
  },
  kk: {
    received: (v) => ({
      subject: `${v.n} өтінімі қабылданды — SHYMKENT STUDIO`,
      title: 'Өтініміңізді алдық',
      intro:
        'SHYMKENT STUDIO-ны таңдағаныңызға рахмет. Бұл әлі растау емес: әкімші уақытты тексеріп, сізбен хабарласады, содан кейін Kaspi төлем сілтемесін жібереді (банк аударымы да мүмкін).',
    }),
    confirmed: (v) => ({
      subject: `${v.n} брондауы расталды`,
      title: 'Уақыт сізге бекітілді',
      intro: 'Сізді SHYMKENT STUDIO-да күтеміз. Төлем әлі жасалмаса, төлем сілтемесін әкімші жібереді.',
    }),
    payment_link: (v) => ({
      subject: `${v.n} тапсырысын төлеу сілтемесі`,
      title: 'Тапсырысты төлеу',
      intro: 'Төлеу үшін төмендегі сілтемеге өтіңіз. Банк аударымымен де төлеуге болады — деректемелерді әкімшіден сұраңыз.',
      cta: 'Төлеу',
    }),
    rescheduled: (v) => ({
      subject: `${v.n} брондауы ауыстырылды`,
      title: 'Жазба ауыстырылды',
      intro: 'Жазылуыңызды ауыстырдық. Жаңа күні мен уақыты төменде.',
    }),
    cancelled: (v) => ({
      subject: `${v.n} брондауы тоқтатылды`,
      title: 'Жазба тоқтатылды',
      intro: 'Жазылуыңыз тоқтатылды. Егер бұл қате болса немесе басқа уақыт таңдағыңыз келсе, бізге жазыңыз.',
    }),
    reminder_24h: (v) => ({
      subject: `Еске салу: жазба ${v.date}, ${v.time}`,
      title: 'Жазба ертең',
      intro: 'SHYMKENT STUDIO-дағы жазбаңыз туралы еске саламыз. Басталуынан 10 минут бұрын келіңіз.',
    }),
    reminder_2h: (v) => ({
      subject: `2 сағаттан кейін — жазбаңыз (${v.time})`,
      title: 'Жақында бастаймыз',
      intro: `Сізді бүгін ${v.time}-да күтеміз.`,
    }),
    ready: (v) => ({
      subject: `${v.n} тапсырысы дайын`,
      title: 'Материалдар дайын',
      intro: 'Бізде жазылғаныңызға рахмет! Материалдарды төмендегі сілтеме арқылы жүктей аласыз.',
      cta: 'Материалдарды ашу',
    }),
    tour_confirmed: (v) => ({
      subject: `${v.n} туры расталды`,
      title: 'Турға күтеміз',
      intro: 'Студия бойынша тегін турға күтеміз.',
    }),
    tour_rescheduled: (v) => ({
      subject: `${v.n} туры ауыстырылды`,
      title: 'Тур ауыстырылды',
      intro: 'Туріңізді ауыстырдық. Жаңа күні мен уақыты төменде.',
    }),
    tour_cancelled: (v) => ({
      subject: `${v.n} туры тоқтатылды`,
      title: 'Тур тоқтатылды',
      intro: 'Туріңіз тоқтатылды. Басқа уақыт таңдағыңыз келсе, бізге жазыңыз.',
    }),
    tour_reminder: (v) => ({
      subject: `Тур туралы еске салу: ${v.date}, ${v.time}`,
      title: 'Туріңіз жақында',
      intro: 'SHYMKENT STUDIO бойынша тегін тур туралы еске саламыз.',
    }),
  },
};

const LABELS: Record<Lang, Record<string, string>> = {
  ru: {
    number: 'Номер',
    service: 'Тариф',
    room: 'Комната',
    date: 'Дата',
    time: 'Время',
    total: 'Стоимость',
    refund: 'Сумма возврата',
    address: 'Адрес',
    policy: 'Условия отмены и переноса',
    questions: 'Вопросы',
    hello: 'Здравствуйте',
  },
  kk: {
    number: 'Нөмірі',
    service: 'Тариф',
    room: 'Бөлме',
    date: 'Күні',
    time: 'Уақыты',
    total: 'Құны',
    refund: 'Қайтарылатын сома',
    address: 'Мекенжай',
    policy: 'Бас тарту және ауыстыру шарттары',
    questions: 'Сұрақтар',
    hello: 'Сәлеметсіз бе',
  },
};

export interface ClientEmailInput {
  number: string;
  clientName: string;
  date: string;
  time: string;
  serviceName?: string;
  roomName?: string;
  total?: number;
  refundAmount?: number | null;
  /** Payment link / materials link (http(s) only). */
  linkUrl?: string | null;
  policy?: PolicyTexts;
  contacts?: StudioContacts;
}

export function clientEmail(kind: ClientEmailKind, lang: Lang, d: ClientEmailInput): RenderedEmail {
  const copy = COPY[lang][kind]({ n: d.number, date: d.date, time: d.time });
  const L = LABELS[lang];
  const contacts = d.contacts ?? DEFAULT_STUDIO_CONTACTS;
  const link = safeUrl(d.linkUrl);
  const items: Rows = [
    [L.number, d.number],
    [L.service, d.serviceName],
    [L.room, d.roomName],
    [L.date, d.date],
    [L.time, d.time],
    [L.total, d.total !== undefined && kind !== 'cancelled' ? money(d.total) : null],
    [L.refund, kind === 'cancelled' && d.refundAmount ? money(d.refundAmount) : null],
    [L.address, addressFor(contacts, lang) || null],
  ];
  const policyLines = d.policy ? [d.policy.full, d.policy.partial, d.policy.none, d.policy.reschedule].filter(Boolean) : [];
  const contactLine = `${L.questions}: ${contacts.email}, WhatsApp +${contacts.whatsapp}`;

  const html = layout(
    `<h2>${escapeHtml(copy.title)}</h2>` +
      `<p>${escapeHtml(`${L.hello}, ${d.clientName}!`)}</p>` +
      `<p>${escapeHtml(copy.intro)}</p>` +
      rows(items) +
      (link && copy.cta
        ? `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#C84A12;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">${escapeHtml(copy.cta)}</a></p>`
        : '') +
      (policyLines.length ? `<h3>${escapeHtml(L.policy)}</h3><ul>${policyLines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : '') +
      `<p style="color:#65605B">${escapeHtml(contactLine)}</p>`,
  );
  const text = [
    copy.title,
    '',
    `${L.hello}, ${d.clientName}!`,
    copy.intro,
    '',
    textRows(items),
    link && copy.cta ? `\n${copy.cta}: ${link}` : '',
    policyLines.length ? `\n${L.policy}:\n${policyLines.join('\n')}` : '',
    '',
    contactLine,
  ].join('\n');
  return { subject: oneLine(copy.subject), html, text };
}

/** Backwards-compatible wrapper: "request received" email. */
export function bookingClientEmail(d: BookingEmailData, lang: Lang, policy: PolicyTexts, contacts?: StudioContacts): RenderedEmail {
  return clientEmail('received', lang, {
    number: d.number,
    clientName: d.clientName,
    date: d.date,
    time: d.time,
    serviceName: d.serviceName,
    roomName: d.roomName,
    total: d.total,
    policy,
    contacts,
  });
}
