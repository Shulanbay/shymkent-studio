import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/admin/format';
import { getGoogleConnectionStatus, isGoogleOAuthConfigured } from '@/lib/integrations/google';
import { policyTexts } from '@/lib/policy';
import { getCancellationPolicy, getCrmOptions, getIntegrationSwitches, getReminderRules, getStudioContacts, getWorkingHours } from '@/lib/settings';
import {
  updateCancellationPolicyAction,
  updateContactsAction,
  updateCrmOptionsAction,
  updateIntegrationSwitchesAction,
  updateRemindersAction,
  updateWorkingHoursAction,
} from './actions';
import { exceptionsToText } from '@/lib/admin/working-hours-form';

export const metadata = { title: 'Настройки' };

const DAY_NAMES: Record<string, string> = {
  '1': 'Понедельник',
  '2': 'Вторник',
  '3': 'Среда',
  '4': 'Четверг',
  '5': 'Пятница',
  '6': 'Суббота',
  '7': 'Воскресенье',
};

const GOOGLE_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: 'Google Calendar подключён.', ok: true },
  denied: { text: 'Доступ к Google Calendar не был предоставлен.', ok: false },
  invalid_state: { text: 'Сессия подключения устарела. Попробуйте ещё раз.', ok: false },
  no_refresh_token: {
    text: 'Google не выдал refresh token. Отзовите доступ приложения в аккаунте Google и подключите заново.',
    ok: false,
  },
  not_configured: { text: 'Не заданы GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.', ok: false },
  error: { text: 'Не удалось подключить Google Calendar.', ok: false },
};

const inputClass =
  'w-full px-3 py-2 border border-border-light rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-accent disabled:bg-bg-light';

export default async function SettingsPage(props: { searchParams: Promise<{ google?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requirePermission('settings:view');
  const canEdit = hasPermission(user.role, 'settings:manage');
  const canManageIntegrations = hasPermission(user.role, 'integrations:manage');

  const [policy, hours, rooms, services, contacts, reminders, crmOptions, switches] = await Promise.all([
    getCancellationPolicy(prisma),
    getWorkingHours(prisma),
    prisma.room.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.service.findMany({ orderBy: { sortOrder: 'asc' } }),
    getStudioContacts(prisma),
    getReminderRules(prisma),
    getCrmOptions(prisma),
    getIntegrationSwitches(prisma),
  ]);
  const google = canManageIntegrations ? await getGoogleConnectionStatus() : null;
  const googleMessage = searchParams.google ? GOOGLE_MESSAGES[searchParams.google] : undefined;
  const preview = policyTexts(policy, 'ru');

  const fields: { name: keyof typeof policy; label: string; max: number }[] = [
    { name: 'fullRefundHours', label: 'Полный возврат, если отмена более чем за (часов)', max: 720 },
    { name: 'partialRefundHours', label: 'Частичный возврат, если отмена не позднее чем за (часов)', max: 720 },
    { name: 'partialRefundPercent', label: 'Размер частичного возврата (%)', max: 100 },
    { name: 'freeReschedules', label: 'Бесплатных переносов', max: 10 },
    { name: 'rescheduleMinHours', label: 'Бесплатный перенос, если запрос более чем за (часов)', max: 720 },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl md:text-3xl font-bold">Настройки</h1>

      <section aria-labelledby="policy-heading" className="bg-white border border-border-light rounded-card p-5">
        <h2 id="policy-heading" className="text-lg font-bold mb-1">
          Правила отмены и переноса
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          Используются на сайте (FAQ, условия, цены, форма бронирования), в письмах и при расчёте возврата. Сумму
          возврата по конкретному заказу администратор может изменить вручную.
        </p>
        <ActionForm action={updateCancellationPolicyAction} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 items-end">
            {fields.map((field) => (
              <div key={field.name}>
                <label htmlFor={field.name} className="block text-xs font-semibold mb-1">
                  {field.label}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type="number"
                  min={0}
                  max={field.max}
                  step={1}
                  required
                  defaultValue={policy[field.name]}
                  disabled={!canEdit}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
          <div className="bg-bg-light rounded-xl p-4 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary mb-1">Как это видят клиенты сейчас:</p>
            <p>{preview.summary}</p>
          </div>
          {canEdit && <SubmitButton>Сохранить правила</SubmitButton>}
        </ActionForm>
      </section>

      <section aria-labelledby="hours-heading" className="bg-white border border-border-light rounded-card p-5">
        <h2 id="hours-heading" className="text-lg font-bold mb-1">
          Рабочее время и онлайн-запись
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          Часовой пояс {hours.timeZone}. Публичная форма показывает только слоты внутри рабочего времени, с учётом буферов комнат и уже
          существующих заказов.
        </p>
        <ActionForm action={updateWorkingHoursAction} className="space-y-5">
          <fieldset>
            <legend className="text-xs font-semibold mb-2">Дни недели</legend>
            <div className="space-y-2">
              {Object.entries(DAY_NAMES).map(([key, name]) => {
                const day = hours.days[key as keyof typeof hours.days];
                return (
                  <div key={key} className="grid grid-cols-[8rem_1fr_1fr_auto] gap-2 items-center text-sm">
                    <span>{name}</span>
                    <label className="sr-only" htmlFor={`open-${key}`}>
                      {name}: открытие
                    </label>
                    <input id={`open-${key}`} name={`open-${key}`} type="time" step={300} defaultValue={day?.open ?? '10:00'} disabled={!canEdit} className={inputClass} />
                    <label className="sr-only" htmlFor={`close-${key}`}>
                      {name}: закрытие
                    </label>
                    <input id={`close-${key}`} name={`close-${key}`} type="time" step={300} defaultValue={day?.close ?? '22:00'} disabled={!canEdit} className={inputClass} />
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <input type="checkbox" name={`closed-${key}`} defaultChecked={!day} disabled={!canEdit} /> выходной
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            {[
              ['slotStepMinutes', 'Шаг слотов, мин', hours.slotStepMinutes],
              ['minLeadMinutes', 'Запись не раньше чем через, мин', hours.minLeadMinutes],
              ['maxAdvanceDays', 'Запись не дальше чем на, дней', hours.maxAdvanceDays],
              ['tourDurationMinutes', 'Длительность тура, мин', hours.tour.durationMinutes],
              ['tourSlotStepMinutes', 'Шаг слотов тура, мин', hours.tour.slotStepMinutes],
            ].map(([name, label, value]) => (
              <div key={String(name)}>
                <label htmlFor={String(name)} className="block text-xs font-semibold mb-1">
                  {label}
                </label>
                <input id={String(name)} name={String(name)} type="number" min={0} step={1} required defaultValue={Number(value)} disabled={!canEdit} className={inputClass} />
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="exceptions" className="block text-xs font-semibold mb-1">
              Исключения (праздники, сокращённые дни): по одному на строку, «2026-12-31 выходной» или «2026-12-30 10:00-16:00»
            </label>
            <textarea id="exceptions" name="exceptions" rows={4} defaultValue={exceptionsToText(hours.exceptions)} disabled={!canEdit} className={`${inputClass} font-mono`} />
          </div>
          {canEdit && <SubmitButton>Сохранить рабочее время</SubmitButton>}
        </ActionForm>
      </section>

      <section aria-labelledby="catalog-heading" className="bg-white border border-border-light rounded-card p-5">
        <h2 id="catalog-heading" className="text-lg font-bold mb-1">
          Комнаты, тарифы и шаблоны задач
        </h2>
        <p className="text-sm text-text-secondary mb-3">
          Активно: {rooms.filter((r) => r.active).length} комнаты, {services.filter((s) => s.active).length} тарифа.
        </p>
        <a href="/admin/settings/catalog" className="text-sm font-semibold text-orange-accent hover:underline">
          Управлять каталогом →
        </a>
      </section>

      <section aria-labelledby="contacts-heading" className="bg-white border border-border-light rounded-card p-5">
        <h2 id="contacts-heading" className="text-lg font-bold mb-1">
          Контакты студии
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          Показываются на сайте (шапка, подвал, «Контакты», условия, политика), в письмах клиентам и в разметке для поисковиков. На сайте
          обновляются в течение нескольких минут.
        </p>
        <ActionForm action={updateContactsAction} className="grid sm:grid-cols-2 gap-3 items-end">
          {(
            [
              ['studioName', 'Название студии', contacts.studioName, 'text'],
              ['email', 'Email', contacts.email, 'email'],
              ['phone', 'Телефон (для показа)', contacts.phone, 'tel'],
              ['whatsapp', 'WhatsApp (цифры, с кодом страны)', contacts.whatsapp, 'text'],
              ['instagram', 'Instagram (имя аккаунта без @)', contacts.instagram, 'text'],
              ['city', 'Город', contacts.city, 'text'],
              ['address', 'Адрес на русском (улица, дом)', contacts.address, 'text'],
              ['addressKk', 'Адрес на казахском (если пусто — русский)', contacts.addressKk, 'text'],
              ['mapUrl', 'Ссылка на карту (2ГИС / Google / Яндекс, https://…)', contacts.mapUrl, 'url'],
              ['openingDate', 'Дата открытия (объявление на сайте до этой даты)', contacts.openingDate, 'date'],
            ] as const
          ).map(([name, label, value, type]) => (
            <div key={name}>
              <label htmlFor={`c-${name}`} className="block text-xs font-semibold mb-1">
                {label}
              </label>
              <input id={`c-${name}`} name={name} type={type} defaultValue={value} disabled={!canEdit} maxLength={200} className={inputClass} />
            </div>
          ))}
          {canEdit && (
            <div>
              <SubmitButton>Сохранить контакты</SubmitButton>
            </div>
          )}
        </ActionForm>
      </section>

      <section aria-labelledby="reminders-heading" className="bg-white border border-border-light rounded-card p-5">
        <h2 id="reminders-heading" className="text-lg font-bold mb-1">
          Напоминания и лиды
        </h2>
        <p className="text-sm text-text-secondary mb-4">Напоминания отправляются клиентам с email после подтверждения заказа или тура. Повторно одно и то же напоминание не уходит.</p>
        <ActionForm action={updateRemindersAction} className="flex flex-wrap items-end gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="booking24h" defaultChecked={reminders.booking24h} disabled={!canEdit} /> За 24 часа до записи
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="booking2h" defaultChecked={reminders.booking2h} disabled={!canEdit} /> За 2 часа до записи
          </label>
          <div>
            <label htmlFor="tourHoursBefore" className="block text-xs font-semibold mb-1">
              Напоминание о туре за, часов (0 — выкл.)
            </label>
            <input id="tourHoursBefore" name="tourHoursBefore" type="number" min={0} max={72} defaultValue={reminders.tourHoursBefore} disabled={!canEdit} className={inputClass} />
          </div>
          {canEdit && <SubmitButton variant="secondary">Сохранить</SubmitButton>}
        </ActionForm>
        <ActionForm action={updateCrmOptionsAction} className="flex flex-wrap items-center gap-4 border-t border-border-light pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="autoLeadFromBooking" defaultChecked={crmOptions.autoLeadFromBooking} disabled={!canEdit} /> Создавать лид для каждой новой заявки на запись
            (для туров лид создаётся всегда)
          </label>
          {canEdit && <SubmitButton variant="secondary">Сохранить</SubmitButton>}
        </ActionForm>
      </section>

      {canManageIntegrations && google && (
        <section aria-labelledby="integrations-heading" className="bg-white border border-border-light rounded-card p-5">
          <h2 id="integrations-heading" className="text-lg font-bold mb-1">
            Интеграции
          </h2>
          <p className="text-sm text-text-secondary mb-4">Доступно только владельцу. Токены хранятся на сервере в зашифрованном виде и никогда не показываются в браузере.</p>
          {googleMessage && (
            <p role="status" className={`text-sm mb-4 ${googleMessage.ok ? 'text-green-700' : 'text-red-700'}`}>
              {googleMessage.text}
            </p>
          )}
          <ActionForm action={updateIntegrationSwitchesAction} className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-border-light">
            <span className="text-sm font-semibold">Включены:</span>
            {(
              [
                ['email', 'Email-уведомления', switches.email],
                ['calendar', 'Google Calendar', switches.calendar],
                ['sheets', 'Google Sheets', switches.sheets],
              ] as const
            ).map(([name, label, on]) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={name} defaultChecked={on} /> {label}
              </label>
            ))}
            <SubmitButton variant="secondary">Сохранить</SubmitButton>
            <p className="w-full text-xs text-text-secondary">
              Интеграция работает, только если она и настроена в переменных окружения, и включена здесь. Уже созданные задачи очереди не отменяются.
            </p>
          </ActionForm>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              <p className="font-semibold">Google Calendar</p>
              <p className="text-text-secondary">
                {google.source === 'database' && `Подключён ${formatDateTime(google.connectedAt ? new Date(google.connectedAt) : null)}`}
                {google.source === 'env' && 'Используется токен из переменной окружения GOOGLE_CALENDAR_REFRESH_TOKEN'}
                {google.source === 'none' && 'Не подключён'}
              </p>
            </div>
            {isGoogleOAuthConfigured() ? (
              // Plain link: the OAuth flow is a full-page redirect to Google.
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a href="/api/auth/login" className="px-4 py-2 rounded-xl text-sm font-semibold border border-border-light hover:border-orange-accent">
                {google.source === 'none' ? 'Подключить' : 'Переподключить'}
              </a>
            ) : (
              <p className="text-sm text-text-secondary">Задайте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
