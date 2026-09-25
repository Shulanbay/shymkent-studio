const TZ = 'Asia/Almaty';

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')} ₸`;
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatDayLong(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

export function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

export const ACTIVITY_LABELS: Record<string, string> = {
  'auth.login': 'Вход в CRM',
  'auth.logout': 'Выход из CRM',
  'auth.login.failed': 'Неудачная попытка входа',
  'auth.login.rate_limited': 'Вход заблокирован лимитом попыток',
  'user.create': 'Создан сотрудник',
  'user.update': 'Изменён сотрудник',
  'user.password_reset': 'Сброшен пароль сотрудника',
  'user.password_change': 'Изменён собственный пароль',
  'settings.update': 'Изменены настройки',
  'integration.google.connect': 'Подключён Google Calendar',
  'seed.owner_created': 'Создан владелец (seed)',
  'booking.create': 'Новая заявка с сайта',
  'booking.status': 'Изменён статус заказа',
  'booking.reschedule': 'Заказ перенесён',
  'booking.cancel': 'Заказ отменён',
  'booking.amount': 'Изменена сумма заказа',
  'booking.update': 'Изменены данные заказа',
  'tour.create': 'Новая заявка на тур',
  'tour.status': 'Изменён статус тура',
  'tour.update': 'Изменены заметки тура',
  'client.update': 'Изменены данные клиента',
  'client.merge': 'Клиенты объединены',
  'integration.retry': 'Повтор интеграции',
  'integration.process': 'Ручной запуск очереди интеграций',
  'spam.honeypot.booking': 'Отклонён спам (форма записи)',
  'spam.honeypot.tour': 'Отклонён спам (форма тура)',
  'user.password_reset.cli': 'Пароль владельца сброшен через CLI',
  'lead.create': 'Создан лид',
  'lead.status': 'Изменён статус лида',
  'lead.update': 'Изменён лид',
  'payment.record': 'Зарегистрирован платёж',
  'payment.confirm': 'Платёж подтверждён',
  'payment.fail': 'Платёж не прошёл',
  'payment.refund': 'Проведён возврат',
  'payment.reverse': 'Сторнирована операция',
  'payment.link': 'Сохранена ссылка на оплату',
  'task.generate': 'Созданы production-задачи',
  'task.create': 'Создана задача',
  'task.update': 'Изменена задача',
  'task.comment': 'Комментарий к задаче',
  'tour.reschedule': 'Тур перенесён',
  'catalog.room': 'Изменена комната',
  'catalog.service': 'Изменён тариф',
};
