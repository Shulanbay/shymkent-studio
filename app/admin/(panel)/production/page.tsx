import Link from 'next/link';
import { TaskKanban } from '@/components/admin/TaskKanban';
import { Badge, EmptyState, Field, PageHeader, Pagination, cardClass, inputClass, linkButtonClass } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin/format';
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_STYLES, TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@/lib/admin/labels';
import { TASK_STATUSES, listTasks, taskFiltersSchema } from '@/lib/admin/production';
import { canWorkOnTask } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatBookingNumber } from '@/lib/public/schemas';
import { PRODUCTION_TYPES } from '@/lib/settings-schema';
import { moveTaskAction } from './actions';

export const metadata = { title: 'Production' };

export default async function ProductionPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await requirePermission('production:view');
  const f = taskFiltersSchema.parse(searchParams);
  const [{ items, total, pages }, staff] = await Promise.all([
    listTasks(prisma, f, user),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const now = Date.now();
  const viewLink = (view: string) => {
    const p = new URLSearchParams(Object.entries({ ...searchParams, view, page: undefined }).filter(([, v]) => v) as [string, string][]);
    return `/admin/production?${p}`;
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Production"
        description="Задачи по заказам: создаются автоматически при подтверждении заказа по шаблону тарифа."
        actions={
          <nav aria-label="Вид" className="flex gap-1 bg-white border border-border-light rounded-xl p-1">
            {(['kanban', 'list'] as const).map((v) => (
              <Link
                key={v}
                href={viewLink(v)}
                aria-current={f.view === v ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm ${f.view === v ? 'bg-brand-gradient text-on-brand font-semibold' : 'hover:bg-bg-light'}`}
              >
                {v === 'kanban' ? 'Канбан' : 'Список'}
              </Link>
            ))}
          </nav>
        }
      />

      <form method="get" role="search" className={`${cardClass} grid grid-cols-2 md:grid-cols-5 gap-3 items-end`}>
        <input type="hidden" name="view" value={f.view} />
        <Field id="assignee" label="Исполнитель">
          <select id="assignee" name="assignee" defaultValue={f.assignee ?? ''} className={inputClass}>
            <option value="">Все</option>
            <option value="me">Мои задачи</option>
            <option value="none">Не назначены</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="type" label="Этап">
          <select id="type" name="type" defaultValue={f.type ?? ''} className={inputClass}>
            <option value="">Все</option>
            {PRODUCTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        {f.view === 'list' && (
          <Field id="status" label="Статус">
            <select id="status" name="status" defaultValue={f.status ?? ''} className={inputClass}>
              <option value="">Все</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="due" label="Срок">
          <select id="due" name="due" defaultValue={f.due ?? ''} className={inputClass}>
            <option value="">Любой</option>
            <option value="overdue">Просроченные</option>
            <option value="today">Сегодня</option>
            <option value="week">Ближайшие 7 дней</option>
          </select>
        </Field>
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-gradient text-on-brand">
            Показать
          </button>
          <Link href={`/admin/production?view=${f.view}`} className={linkButtonClass}>
            Сброс
          </Link>
        </div>
      </form>

      {f.view === 'kanban' ? (
        <TaskKanban
          move={moveTaskAction}
          columns={TASK_STATUSES.map((s) => ({ status: s, label: TASK_STATUS_LABELS[s] }))}
          tasks={items.map((t) => ({
            id: t.id,
            status: t.status,
            title: t.title,
            typeLabel: TASK_TYPE_LABELS[t.type],
            booking: formatBookingNumber(t.booking.bookingNumber),
            client: t.booking.client.name,
            due: t.dueAt ? formatDateTime(t.dueAt) : null,
            overdue: Boolean(t.dueAt && t.dueAt.getTime() < now && t.status !== 'DONE'),
            assignee: t.assignedTo?.name ?? null,
            priority: TASK_PRIORITY_LABELS[t.priority],
            priorityClass: TASK_PRIORITY_STYLES[t.priority],
            comments: t._count.comments,
            movable: canWorkOnTask(user, t),
          }))}
        />
      ) : (
        <>
          <div className={`${cardClass} p-0 md:p-0 overflow-x-auto`}>
            {items.length === 0 ? (
              <EmptyState>Задач нет.</EmptyState>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Задачи</caption>
                <thead className="text-left text-text-secondary border-b border-border-light">
                  <tr>
                    <th scope="col" className="px-4 py-3">Задача</th>
                    <th scope="col" className="px-4 py-3">Заказ</th>
                    <th scope="col" className="px-4 py-3">Статус</th>
                    <th scope="col" className="px-4 py-3">Срок</th>
                    <th scope="col" className="px-4 py-3">Исполнитель</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {items.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/production/${t.id}`} className="font-semibold text-brand-ink hover:underline">
                          {t.title}
                        </Link>
                        <span className="block text-xs text-text-secondary">
                          {TASK_TYPE_LABELS[t.type]} · <Badge className={TASK_PRIORITY_STYLES[t.priority]}>{TASK_PRIORITY_LABELS[t.priority]}</Badge>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatBookingNumber(t.booking.bookingNumber)}
                        <span className="block text-xs text-text-secondary">{t.booking.client.name}</span>
                      </td>
                      <td className="px-4 py-3">{TASK_STATUS_LABELS[t.status]}</td>
                      <td className={`px-4 py-3 whitespace-nowrap ${t.dueAt && t.dueAt.getTime() < now && t.status !== 'DONE' ? 'text-red-700 font-semibold' : ''}`}>
                        {formatDateTime(t.dueAt)}
                      </td>
                      <td className="px-4 py-3">{t.assignedTo?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination basePath="/admin/production" params={searchParams} page={f.page} pages={pages} total={total} />
        </>
      )}
    </div>
  );
}
