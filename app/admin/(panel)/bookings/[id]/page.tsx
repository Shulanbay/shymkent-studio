import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ActivityList } from '@/components/admin/ActivityList';
import { Badge, Field, cardClass, inputClass, linkButtonClass } from '@/components/admin/ui';
import { durationMinutes, formatDate, formatDateTime, formatMoney, formatTime } from '@/lib/admin/format';
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_STYLES,
  BOOKING_TRANSITIONS,
  PAYMENT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from '@/lib/admin/labels';
import { generateSlots } from '@/lib/availability';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { loadRoomBusy } from '@/lib/bookings/shared';
import { prisma } from '@/lib/db';
import { JOB_LABELS, jobStatusText, type JobType } from '@/lib/outbox/jobs';
import { formatKzPhone } from '@/lib/phone';
import { canRescheduleFree, computeRefund } from '@/lib/policy';
import { formatBookingNumber } from '@/lib/public/schemas';
import { getCancellationPolicy, getWorkingHours } from '@/lib/settings';
import { todayInStudio, utcToZoned } from '@/lib/time';
import { amountAction, cancelAction, changeStatusAction, createLeadFromBookingAction, detailsAction, rescheduleAction } from '../actions';
import { createTaskAction } from '../../production/actions';
import { PaymentsBlock } from '@/components/admin/PaymentsBlock';
import { PRODUCTION_TYPES } from '@/lib/settings-schema';

export const metadata = { title: 'Заказ' };

const ACTIVE = ['REQUESTED', 'CONTACTED', 'PENDING_PAYMENT', 'CONFIRMED'];

export default async function BookingDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ rd?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const user = await requirePermission('bookings:view');
  const can = {
    manage: hasPermission(user.role, 'bookings:manage'),
    amount: hasPermission(user.role, 'payments:manage'),
    refund: hasPermission(user.role, 'refunds:manage'),
    payments: hasPermission(user.role, 'payments:view'),
    production: hasPermission(user.role, 'production:view'),
    productionManage: hasPermission(user.role, 'production:manage'),
    leads: hasPermission(user.role, 'leads:manage'),
    clients: hasPermission(user.role, 'clients:view'),
    integrations: hasPermission(user.role, 'integrations:view'),
  };

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      room: true,
      service: true,
      assignedTo: { select: { id: true, name: true } },
      payments: { orderBy: { createdAt: 'desc' }, include: { reversedBy: { select: { id: true } }, recordedBy: { select: { name: true } } } },
      productionTasks: { orderBy: { dueAt: 'asc' }, include: { assignedTo: { select: { name: true } } } },
      lead: { select: { id: true, status: true } },
    },
  });
  if (!booking) notFound();

  const now = new Date();
  const [activity, jobs, staff, policy, hours] = await Promise.all([
    prisma.activityLog.findMany({
      where: { entityType: 'Booking', entityId: booking.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
    can.integrations
      ? prisma.integrationJob.findMany({ where: { entityType: 'Booking', entityId: booking.id }, orderBy: { createdAt: 'desc' } })
      : Promise.resolve([]),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    getCancellationPolicy(prisma),
    getWorkingHours(prisma),
  ]);

  const minutes = durationMinutes(booking.startAt, booking.endAt);
  const number = formatBookingNumber(booking.bookingNumber);
  const isActive = ACTIVE.includes(booking.status);
  const refundQuote = computeRefund(policy, { paidAmount: booking.paidAmount, startAt: booking.startAt, now });
  const freeReschedule = canRescheduleFree(policy, { rescheduleCount: booking.rescheduleCount, startAt: booking.startAt, now });

  // Reschedule: free slots for the chosen day in the same room, excluding this booking itself.
  const rescheduleDate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.rd ?? '') ? searchParams.rd! : undefined;
  const rescheduleSlots =
    can.manage && isActive && rescheduleDate
      ? generateSlots({
          date: rescheduleDate,
          durationMinutes: minutes,
          bufferBeforeMinutes: booking.room.bufferBeforeMinutes,
          bufferAfterMinutes: booking.room.bufferAfterMinutes,
          stepMinutes: hours.slotStepMinutes,
          busy: await loadRoomBusy(prisma, booking.roomId, rescheduleDate, booking.id),
          hours,
          now,
          ignoreLeadAndHorizon: true,
        })
      : [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <Link href="/admin/bookings" className="text-sm text-text-secondary hover:underline">
            ← Все заказы
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold flex flex-wrap items-center gap-3 mt-1">
            Заказ {number} <Badge className={BOOKING_STATUS_STYLES[booking.status]}>{BOOKING_STATUS_LABELS[booking.status]}</Badge>
          </h1>
          <p className="text-text-secondary text-sm mt-1">Создан {formatDateTime(booking.createdAt)} · источник: {booking.source ?? '—'}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className={cardClass} aria-labelledby="summary-h">
            <h2 id="summary-h" className="text-lg font-bold mb-4">
              Съёмка
            </h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-text-secondary">Дата и время</dt>
                <dd className="font-semibold">
                  {formatDate(booking.startAt)}, {formatTime(booking.startAt)}–{formatTime(booking.endAt)}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Длительность</dt>
                <dd className="font-semibold">{minutes} мин</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Комната</dt>
                <dd className="font-semibold inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: booking.room.color }} aria-hidden="true" />
                  {booking.room.nameRu}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Тариф</dt>
                <dd className="font-semibold">{booking.service.nameRu}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Участников</dt>
                <dd className="font-semibold">
                  {booking.participants} (вместимость {booking.room.capacity})
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Переносов</dt>
                <dd className="font-semibold">{booking.rescheduleCount}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-text-secondary">Комментарий клиента</dt>
                <dd className="whitespace-pre-wrap break-words">{booking.comment || '—'}</dd>
              </div>
              {booking.status === 'CANCELLED' && (
                <div className="sm:col-span-2">
                  <dt className="text-text-secondary">Отмена</dt>
                  <dd>
                    {formatDateTime(booking.cancelledAt)} — {booking.cancellationReason}
                    {booking.refundAmount !== null && `; возврат ${formatMoney(booking.refundAmount)}`}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {can.manage && BOOKING_TRANSITIONS[booking.status].length > 0 && (
            <section className={cardClass} aria-labelledby="status-h">
              <h2 id="status-h" className="text-lg font-bold mb-3">
                Статус
              </h2>
              <ActionForm action={changeStatusAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="bookingId" value={booking.id} />
                {BOOKING_TRANSITIONS[booking.status].map((s) => (
                  <button
                    key={s}
                    type="submit"
                    name="status"
                    value={s}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border border-border-light bg-white hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong"
                  >
                    → {BOOKING_STATUS_LABELS[s]}
                  </button>
                ))}
              </ActionForm>
            </section>
          )}

          {can.manage && isActive && (
            <section className={cardClass} aria-labelledby="resched-h">
              <h2 id="resched-h" className="text-lg font-bold mb-1">
                Перенос
              </h2>
              <p className="text-sm text-text-secondary mb-3">
                {freeReschedule.allowed
                  ? 'По правилам этот перенос бесплатный.'
                  : freeReschedule.reason === 'LIMIT_REACHED'
                    ? 'Бесплатный перенос уже использован.'
                    : `До съёмки меньше ${policy.rescheduleMinHours} ч — перенос не бесплатный по правилам.`}{' '}
                Показаны только свободные слоты этой комнаты с учётом буферов.
              </p>
              <form method="get" className="flex flex-wrap items-end gap-2 mb-4">
                <Field id="rd" label="Новая дата">
                  <input id="rd" name="rd" type="date" defaultValue={rescheduleDate ?? todayInStudio(now)} className={inputClass} />
                </Field>
                <button type="submit" className={linkButtonClass}>
                  Показать слоты
                </button>
              </form>
              {rescheduleDate &&
                (rescheduleSlots.length === 0 ? (
                  <p className="text-sm text-text-secondary">На {rescheduleDate} свободных слотов нет.</p>
                ) : (
                  <ActionForm action={rescheduleAction}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="date" value={rescheduleDate} />
                    <fieldset>
                      <legend className="text-xs font-semibold mb-2">Время на {rescheduleDate}</legend>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                        {rescheduleSlots.map((slot) => (
                          <label
                            key={slot.time}
                            className="text-center py-1.5 border border-border-light rounded-lg text-sm cursor-pointer has-[:checked]:bg-brand-gradient has-[:checked]:text-on-brand focus-within:ring-2 focus-within:ring-brand-strong"
                          >
                            <input type="radio" name="time" value={slot.time} required className="sr-only" />
                            {slot.time}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <SubmitButton>Перенести</SubmitButton>
                  </ActionForm>
                ))}
            </section>
          )}

          <section className={cardClass} aria-labelledby="notes-h">
            <h2 id="notes-h" className="text-lg font-bold mb-3">
              Ответственный, заметки, материалы
            </h2>
            <ActionForm action={detailsAction} className="space-y-3">
              <input type="hidden" name="bookingId" value={booking.id} />
              <Field id="assignedToId" label="Ответственный">
                <select id="assignedToId" name="assignedToId" defaultValue={booking.assignedToId ?? ''} disabled={!can.manage} className={inputClass}>
                  <option value="">Не назначен</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="internalNotes" label="Внутренние заметки (клиент их не видит)">
                <textarea
                  id="internalNotes"
                  name="internalNotes"
                  defaultValue={booking.internalNotes ?? ''}
                  maxLength={5000}
                  rows={4}
                  disabled={!can.manage}
                  className={inputClass}
                />
              </Field>
              <Field id="materialsUrl" label="Ссылка на Google Drive / готовые материалы">
                <input
                  id="materialsUrl"
                  name="materialsUrl"
                  type="url"
                  defaultValue={booking.materialsUrl ?? ''}
                  maxLength={1000}
                  disabled={!can.manage}
                  placeholder="https://drive.google.com/…"
                  className={inputClass}
                />
              </Field>
              {booking.materialsUrl && (
                <a href={booking.materialsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-ink hover:underline break-all">
                  Открыть материалы ↗
                </a>
              )}
              {can.manage && <SubmitButton>Сохранить</SubmitButton>}
            </ActionForm>
          </section>

          <section className={cardClass} aria-labelledby="tasks-h">
            <h2 id="tasks-h" className="text-lg font-bold mb-3">
              Production-задачи
            </h2>
            {booking.productionTasks.length > 0 && (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                Заказ {booking.status === 'CANCELLED' ? 'отменён' : 'закрыт как «не пришёл»'}: задачи сняты с production-доски и больше не
                считаются просроченными.
              </p>
            )}
            {booking.productionTasks.length === 0 ? (
              <p className="text-sm text-text-secondary">Задачи создаются автоматически, когда заказ подтверждён.</p>
            ) : (
              <ul className="divide-y divide-border-light text-sm">
                {booking.productionTasks.map((task) => (
                  <li key={task.id} className="py-2 flex flex-wrap justify-between gap-2">
                    {can.production ? (
                      <Link href={`/admin/production/${task.id}`} className="hover:underline">
                        {task.title} <span className="text-text-secondary">({TASK_TYPE_LABELS[task.type]})</span>
                      </Link>
                    ) : (
                      <span>{task.title}</span>
                    )}
                    <span className="text-text-secondary">
                      {TASK_STATUS_LABELS[task.status]} · {task.assignedTo?.name ?? 'не назначен'} · срок {formatDateTime(task.dueAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {can.productionManage && booking.status !== 'CANCELLED' && booking.status !== 'NO_SHOW' && (
              <details className="mt-3">
                <summary className="text-sm font-semibold cursor-pointer">Добавить задачу</summary>
                <ActionForm action={createTaskAction} resetOnSuccess className="grid sm:grid-cols-2 gap-2 mt-2">
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <Field id="t-title" label="Название">
                    <input id="t-title" name="title" required minLength={2} maxLength={120} className={inputClass} />
                  </Field>
                  <Field id="t-type" label="Этап">
                    <select id="t-type" name="type" className={inputClass}>
                      {PRODUCTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TASK_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="t-due" label="Срок">
                    <input id="t-due" name="dueAt" type="datetime-local" className={inputClass} />
                  </Field>
                  <Field id="t-assignee" label="Исполнитель">
                    <select id="t-assignee" name="assignedToId" className={inputClass}>
                      <option value="">Не назначен</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div>
                    <SubmitButton variant="secondary">Добавить</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            )}
          </section>

          <section className={cardClass} aria-labelledby="history-h">
            <h2 id="history-h" className="text-lg font-bold mb-3">
              История изменений
            </h2>
            <ActivityList items={activity} />
          </section>
        </div>

        <div className="space-y-6">
          <section className={cardClass} aria-labelledby="client-h">
            <h2 id="client-h" className="text-lg font-bold mb-3">
              Клиент
            </h2>
            <p className="font-semibold">{booking.client.name}</p>
            <p className="text-sm">
              <a href={`tel:${booking.client.normalizedPhone}`} className="hover:underline">
                {formatKzPhone(booking.client.normalizedPhone)}
              </a>
            </p>
            {booking.client.email && <p className="text-sm break-all">{booking.client.email}</p>}
            <p className="text-sm text-text-secondary">Язык: {booking.locale === 'KK' ? 'казахский' : 'русский'}</p>
            <p className="text-sm text-text-secondary">
              Условия приняты: {booking.termsAcceptedAt ? `${formatDateTime(booking.termsAcceptedAt)} (версия ${booking.termsVersion})` : '—'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <a
                href={`https://wa.me/${booking.client.normalizedPhone.replace('+', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={linkButtonClass}
              >
                WhatsApp
              </a>
              {can.clients && (
                <Link href={`/admin/clients/${booking.client.id}`} className={linkButtonClass}>
                  Карточка клиента
                </Link>
              )}
              {booking.lead ? (
                <Link href={`/admin/leads/${booking.lead.id}`} className={linkButtonClass}>
                  Лид
                </Link>
              ) : (
                can.leads && (
                  <ActionForm action={createLeadFromBookingAction}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <SubmitButton variant="secondary">Создать лид</SubmitButton>
                  </ActionForm>
                )
              )}
            </div>
          </section>

          <section className={cardClass} aria-labelledby="money-h">
            <h2 id="money-h" className="text-lg font-bold mb-3">
              Сумма и оплата
            </h2>
            {can.payments ? (
              <PaymentsBlock
                booking={booking}
                payments={booking.payments}
                can={{ view: true, record: can.amount, adjust: can.refund }}
                hasClientEmail={Boolean(booking.client.email)}
              />
            ) : (
              <p className="text-sm">
                {formatMoney(booking.totalAmount)} · {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
              </p>
            )}
            {can.amount && booking.status !== 'CANCELLED' && (
              <details className="border-t border-border-light pt-3 mt-3">
              <summary className="font-semibold text-sm cursor-pointer">Изменить стоимость заказа</summary>
              <ActionForm action={amountAction} className="space-y-2 mt-2">
                <input type="hidden" name="bookingId" value={booking.id} />
                <Field id="totalAmount" label="Изменить сумму, ₸">
                  <input
                    id="totalAmount"
                    name="totalAmount"
                    type="number"
                    min={0}
                    step={1}
                    required
                    defaultValue={booking.totalAmount}
                    className={inputClass}
                  />
                </Field>
                <Field id="amountReason" label="Причина (обязательно)">
                  <input id="amountReason" name="reason" required minLength={5} maxLength={500} className={inputClass} />
                </Field>
                <SubmitButton variant="secondary">Изменить сумму</SubmitButton>
              </ActionForm>
            </details>
            )}
          </section>

          {can.manage && booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
            <section className={cardClass} aria-labelledby="cancel-h">
              <h2 id="cancel-h" className="text-lg font-bold mb-1">
                Отмена
              </h2>
              <p className="text-sm text-text-secondary mb-3">
                До съёмки {Math.max(0, Math.floor(refundQuote.hoursBefore))} ч. По правилам возврат {refundQuote.percent}% от оплаченного:{' '}
                <strong>{formatMoney(refundQuote.amount)}</strong>.
              </p>
              <ActionForm action={cancelAction} className="space-y-2">
                <input type="hidden" name="bookingId" value={booking.id} />
                <Field id="cancelReason" label="Причина отмены (обязательно)">
                  <input id="cancelReason" name="reason" required minLength={3} maxLength={500} className={inputClass} />
                </Field>
                {can.refund && booking.paidAmount > 0 && (
                  <>
                    <Field id="refundAmount" label="Другая сумма возврата, ₸ (необязательно)">
                      <input id="refundAmount" name="refundAmount" type="number" min={0} max={booking.paidAmount} step={1} className={inputClass} />
                    </Field>
                    <Field id="overrideReason" label="Причина другой суммы">
                      <input id="overrideReason" name="overrideReason" maxLength={500} className={inputClass} />
                    </Field>
                  </>
                )}
                <SubmitButton variant="danger" confirm="Отменить заказ? Время освободится, клиенту (если указан email) уйдёт письмо об отмене. Вернуть заказ из отмены нельзя.">Отменить заказ</SubmitButton>
              </ActionForm>
            </section>
          )}

          {can.integrations && (
            <section className={cardClass} aria-labelledby="jobs-h">
              <h2 id="jobs-h" className="text-lg font-bold mb-3">
                Интеграции
              </h2>
              {jobs.length === 0 ? (
                <p className="text-sm text-text-secondary">Нет задач (интеграции не настроены).</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {jobs.map((j) => (
                    <li key={j.id} className="flex justify-between gap-2">
                      <span>{JOB_LABELS[j.type as JobType] ?? j.type}</span>
                      <span className={j.status === 'FAILED' ? 'text-red-700 font-semibold' : 'text-text-secondary'}>{jobStatusText(j)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/admin/integrations" className="text-sm text-brand-ink hover:underline mt-2 inline-block">
                Очередь интеграций →
              </Link>
            </section>
          )}
          <p className="text-xs text-text-secondary">Время: {utcToZoned(now).time} (Asia/Almaty)</p>
        </div>
      </div>
    </div>
  );
}
