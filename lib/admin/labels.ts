import type { BookingPaymentStatus, BookingStatus, LeadStatus, PaymentKind, PaymentMethod, PaymentStatus, ProductionTaskStatus, ProductionTaskType, TaskPriority, TourStatus } from '@prisma/client';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  REQUESTED: 'Новая заявка',
  CONTACTED: 'Связались',
  PENDING_PAYMENT: 'Ждёт оплаты',
  CONFIRMED: 'Подтверждён',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  NO_SHOW: 'Не пришёл',
};

export const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  REQUESTED: 'bg-orange-100 text-orange-800',
  CONTACTED: 'bg-sky-100 text-sky-800',
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-200 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-red-50 text-red-700',
};

export const PAYMENT_STATUS_LABELS: Record<BookingPaymentStatus, string> = {
  UNPAID: 'Не оплачен',
  PARTIALLY_PAID: 'Частично',
  PAID: 'Оплачен',
  REFUNDED: 'Возврат',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  KASPI: 'Kaspi',
  CASH: 'Наличные (вручную)',
  BANK_TRANSFER: 'Банковский перевод',
  OTHER: 'Другое',
};

export const TOUR_STATUS_LABELS: Record<TourStatus, string> = {
  NEW: 'Новая',
  CONFIRMED: 'Подтверждена',
  COMPLETED: 'Проведена',
  CANCELLED: 'Отменена',
  NO_SHOW: 'Не пришёл',
};

export const TOUR_STATUS_STYLES: Record<TourStatus, string> = {
  NEW: 'bg-orange-100 text-orange-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-200 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-red-50 text-red-700',
};

export const TOUR_FORMAT_LABELS: Record<string, string> = {
  podcast: 'Подкаст',
  interview: 'Интервью',
  roundtable: 'Круглый стол',
  other: 'Другое',
};

/** Allowed manual status transitions. Cancellation has its own flow (reason + refund). */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ['CONTACTED', 'PENDING_PAYMENT', 'CONFIRMED'],
  CONTACTED: ['PENDING_PAYMENT', 'CONFIRMED', 'REQUESTED'],
  PENDING_PAYMENT: ['CONFIRMED', 'CONTACTED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'PENDING_PAYMENT'],
  COMPLETED: ['CONFIRMED'],
  NO_SHOW: ['CONFIRMED'],
  CANCELLED: [],
};

export const TOUR_TRANSITIONS: Record<TourStatus, TourStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'NEW'],
  COMPLETED: ['CONFIRMED'],
  NO_SHOW: ['CONFIRMED'],
  CANCELLED: [],
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Новый',
  CONTACTED: 'Связались',
  TOUR_SCHEDULED: 'Тур назначен',
  OFFER_SENT: 'Предложение отправлено',
  WON: 'Успешно',
  LOST: 'Отказ',
};

export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: 'bg-orange-100 text-orange-800',
  CONTACTED: 'bg-sky-100 text-sky-800',
  TOUR_SCHEDULED: 'bg-violet-100 text-violet-800',
  OFFER_SENT: 'bg-amber-100 text-amber-800',
  WON: 'bg-green-100 text-green-800',
  LOST: 'bg-gray-200 text-gray-700',
};

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  'website-tour': 'Сайт: тур',
  'website-booking': 'Сайт: запись',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  phone: 'Звонок',
  referral: 'Рекомендация',
  'walk-in': 'Пришёл в студию',
  other: 'Другое',
};

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  PAYMENT: 'Оплата',
  REFUND: 'Возврат',
  REVERSAL: 'Сторно',
};

export const PAYMENT_ENTRY_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Ожидает',
  PAID: 'Проведён',
  FAILED: 'Не прошёл',
  REFUNDED: 'Возвращён',
};

export const TASK_TYPE_LABELS: Record<ProductionTaskType, string> = {
  PREPARATION: 'Подготовка',
  RECORDING: 'Запись',
  EDITING: 'Монтаж',
  THUMBNAIL: 'Обложка',
  SHORTS: 'Shorts / Reels',
  REVIEW: 'Проверка',
  DELIVERY: 'Передача',
  PUBLISHING: 'Публикация',
};

export const TASK_STATUS_LABELS: Record<ProductionTaskStatus, string> = {
  TODO: 'К выполнению',
  IN_PROGRESS: 'В работе',
  REVIEW: 'На проверке',
  DONE: 'Готово',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Низкий',
  NORMAL: 'Обычный',
  HIGH: 'Высокий',
  URGENT: 'Срочно',
};

export const TASK_PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  NORMAL: 'bg-sky-50 text-sky-800',
  HIGH: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-red-100 text-red-800',
};
