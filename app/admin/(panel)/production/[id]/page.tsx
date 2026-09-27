import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ActivityList } from '@/components/admin/ActivityList';
import { Badge, Field, cardClass, inputClass } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin/format';
import {
  PAYMENT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from '@/lib/admin/labels';
import { TASK_PRIORITIES, TASK_STATUSES, parseChecklist, isInactiveBooking } from '@/lib/admin/production';
import { canWorkOnTask, hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatBookingNumber } from '@/lib/public/schemas';
import { utcToZoned } from '@/lib/time';
import { commentTaskAction, updateTaskAction } from '../actions';

export const metadata = { title: 'Задача' };

const toLocalInput = (d: Date | null) => {
  if (!d) return '';
  const z = utcToZoned(d);
  return `${z.date}T${z.time}`;
};

export default async function TaskPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await requirePermission('production:view');
  const task = await prisma.productionTask.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      booking: { select: { id: true, bookingNumber: true, status: true, startAt: true, paymentStatus: true, materialsUrl: true, client: { select: { name: true } }, service: { select: { nameRu: true } }, room: { select: { nameRu: true } } } },
      comments: { orderBy: { createdAt: 'asc' }, include: { user: { select: { name: true } } } },
    },
  });
  if (!task) notFound();
  const frozen = isInactiveBooking(task.booking.status);
  const canWork = canWorkOnTask(user, task) && !frozen;
  const canManage = hasPermission(user.role, 'production:manage');
  const canOpenBooking = hasPermission(user.role, 'bookings:view');
  const checklist = parseChecklist(task.checklist);
  const [staff, activity] = await Promise.all([
    canManage ? prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }) : Promise.resolve([]),
    prisma.activityLog.findMany({
      where: { entityType: 'ProductionTask', entityId: task.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
  ]);
  const overdue = !frozen && task.dueAt && task.dueAt.getTime() < Date.now() && task.status !== 'DONE';

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/admin/production" className="text-sm text-text-secondary hover:underline">
          ← Production
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">{task.title}</h1>
        <p className="text-sm text-text-secondary flex flex-wrap gap-2 items-center mt-1">
          {TASK_TYPE_LABELS[task.type]} · {TASK_STATUS_LABELS[task.status]} ·{' '}
          <Badge className={TASK_PRIORITY_STYLES[task.priority]}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
          <span className={overdue ? 'text-red-700 font-semibold' : ''}>Срок: {formatDateTime(task.dueAt)}</span>
          · {task.assignedTo?.name ?? 'не назначен'}
        </p>
        {frozen && (
          <p className="text-sm mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Заказ отменён или клиент не пришёл — задача заморожена и доступна только для просмотра.
          </p>
        )}
        {!canWork && !frozen && <p className="text-sm mt-2 text-text-secondary">Только просмотр: задача назначена другому сотруднику или относится к другому этапу.</p>}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className={cardClass} aria-labelledby="work-h">
            <h2 id="work-h" className="text-lg font-bold mb-3">
              Работа
            </h2>
            <ActionForm action={updateTaskAction} className="space-y-4">
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="checklistPresent" value="1" />
              <Field id="status" label="Статус">
                <select id="status" name="status" defaultValue={task.status} disabled={!canWork} className={inputClass}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <fieldset>
                <legend className="text-xs font-semibold mb-2">Чек-лист</legend>
                {checklist.length === 0 && <p className="text-sm text-text-secondary">Пунктов нет.</p>}
                <ul className="space-y-1">
                  {checklist.map((item, i) => (
                    <li key={i}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`check-${i}`} defaultChecked={item.done} disabled={!canWork} className="w-4 h-4" />
                        <span className={item.done ? 'line-through text-text-secondary' : ''}>{item.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {canWork && (
                  <div className="mt-2">
                    <label htmlFor="newItem" className="sr-only">
                      Новый пункт
                    </label>
                    <input id="newItem" name="newItem" maxLength={200} placeholder="Добавить пункт…" className={inputClass} />
                  </div>
                )}
              </fieldset>
              <Field id="materialsUrl" label="Ссылка на материалы">
                <input id="materialsUrl" name="materialsUrl" type="url" defaultValue={task.materialsUrl ?? ''} maxLength={1000} disabled={!canWork} placeholder="https://drive.google.com/…" className={inputClass} />
              </Field>
              <Field id="notes" label="Внутренние заметки">
                <textarea id="notes" name="notes" rows={3} maxLength={5000} defaultValue={task.notes ?? ''} disabled={!canWork} className={inputClass} />
              </Field>
              {task.type === 'DELIVERY' && (
                <p className="text-xs text-text-secondary">
                  Когда задача передачи отмечена «Готово» и есть ссылка на материалы, клиент получит письмо «Заказ готов» (один раз).
                </p>
              )}
              {canManage && (
                <div className="grid sm:grid-cols-2 gap-3 border-t border-border-light pt-4">
                  <Field id="title" label="Название">
                    <input id="title" name="title" defaultValue={task.title} maxLength={120} className={inputClass} />
                  </Field>
                  <Field id="assignedToId" label="Исполнитель">
                    <select id="assignedToId" name="assignedToId" defaultValue={task.assignedToId ?? ''} className={inputClass}>
                      <option value="">Не назначен</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="dueAt" label="Срок (время Алматы)">
                    <input id="dueAt" name="dueAt" type="datetime-local" defaultValue={toLocalInput(task.dueAt)} className={inputClass} />
                  </Field>
                  <Field id="priority" label="Приоритет">
                    <select id="priority" name="priority" defaultValue={task.priority} className={inputClass}>
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {TASK_PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
              {canWork && <SubmitButton>Сохранить</SubmitButton>}
            </ActionForm>
          </section>

          <section className={cardClass} aria-labelledby="comments-h">
            <h2 id="comments-h" className="text-lg font-bold mb-3">
              Комментарии
            </h2>
            {task.comments.length === 0 ? (
              <p className="text-sm text-text-secondary mb-3">Комментариев нет.</p>
            ) : (
              <ul className="space-y-3 mb-4">
                {task.comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <p className="text-xs text-text-secondary">
                      {c.user?.name ?? 'Сотрудник'} · {formatDateTime(c.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {canWork && (
              <ActionForm action={commentTaskAction} resetOnSuccess className="space-y-2">
                <input type="hidden" name="taskId" value={task.id} />
                <label htmlFor="body" className="sr-only">
                  Комментарий
                </label>
                <textarea id="body" name="body" rows={2} required maxLength={2000} className={inputClass} />
                <SubmitButton variant="secondary">Добавить комментарий</SubmitButton>
              </ActionForm>
            )}
          </section>

          <section className={cardClass} aria-labelledby="hist-h">
            <h2 id="hist-h" className="text-lg font-bold mb-3">
              История
            </h2>
            <ActivityList items={activity} />
          </section>
        </div>

        <section className={`${cardClass} h-fit`} aria-labelledby="booking-h">
          <h2 id="booking-h" className="text-lg font-bold mb-2">
            Заказ
          </h2>
          <p className="font-semibold">
            {canOpenBooking ? (
              <Link href={`/admin/bookings/${task.booking.id}`} className="text-brand-ink hover:underline">
                {formatBookingNumber(task.booking.bookingNumber)}
              </Link>
            ) : (
              formatBookingNumber(task.booking.bookingNumber)
            )}
          </p>
          <p className="text-sm">{task.booking.client.name}</p>
          <p className="text-sm text-text-secondary">
            {task.booking.service.nameRu} · {task.booking.room.nameRu}
          </p>
          <p className="text-sm text-text-secondary">Съёмка: {formatDateTime(task.booking.startAt)}</p>
          <p className="text-sm text-text-secondary">Оплата: {PAYMENT_STATUS_LABELS[task.booking.paymentStatus]}</p>
          <p className="mt-2">
            <Link href={`/admin/production?booking=${task.booking.id}&view=list`} className="text-sm text-brand-ink hover:underline">
              Все задачи заказа →
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
