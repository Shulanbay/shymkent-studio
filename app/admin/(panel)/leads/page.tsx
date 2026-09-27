import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { LeadKanban } from '@/components/admin/LeadKanban';
import { Badge, EmptyState, Field, PageHeader, Pagination, cardClass, inputClass, linkButtonClass } from '@/components/admin/ui';
import { formatDate, formatDateTime, formatMoney } from '@/lib/admin/format';
import { LEAD_SORTS, LEAD_SOURCES, LEAD_STATUSES, leadFiltersSchema, listLeads } from '@/lib/admin/leads';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_STYLES } from '@/lib/admin/labels';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatKzPhone } from '@/lib/phone';
import { createLeadAction, moveLeadAction } from './actions';

export const metadata = { title: 'Лиды' };

const SORT_LABELS: Record<keyof typeof LEAD_SORTS, string> = {
  created_desc: 'Сначала новые',
  next_contact: 'По дате следующего контакта',
  amount_desc: 'По ожидаемой сумме',
  updated_desc: 'Недавно изменённые',
};

export default async function LeadsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await requirePermission('leads:view');
  const canManage = hasPermission(user.role, 'leads:manage');
  const f = leadFiltersSchema.parse(searchParams);
  const [{ items, total, pages }, staff] = await Promise.all([
    listLeads(prisma, f, user),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const now = Date.now();
  const viewLink = (view: string) => {
    const p = new URLSearchParams(Object.entries({ ...searchParams, view, page: undefined }).filter(([, v]) => v) as [string, string][]);
    return `/admin/leads?${p}`;
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Лиды"
        description="Воронка продаж. Лиды из заявок на тур создаются автоматически."
        actions={
          <nav aria-label="Вид" className="flex gap-1 bg-white border border-border-light rounded-xl p-1">
            {(['kanban', 'table'] as const).map((v) => (
              <Link
                key={v}
                href={viewLink(v)}
                aria-current={f.view === v ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm ${f.view === v ? 'bg-brand-gradient text-on-brand font-semibold' : 'hover:bg-bg-light'}`}
              >
                {v === 'kanban' ? 'Канбан' : 'Таблица'}
              </Link>
            ))}
          </nav>
        }
      />

      <form method="get" role="search" className={`${cardClass} grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 items-end`}>
        <input type="hidden" name="view" value={f.view} />
        <div className="col-span-2">
          <Field id="q" label="Поиск: имя, телефон, тема">
            <input id="q" name="q" defaultValue={f.q} maxLength={100} className={inputClass} />
          </Field>
        </div>
        {f.view === 'table' && (
          <Field id="status" label="Статус">
            <select id="status" name="status" defaultValue={f.status ?? ''} className={inputClass}>
              <option value="">Все</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="source" label="Источник">
          <select id="source" name="source" defaultValue={f.source ?? ''} className={inputClass}>
            <option value="">Все</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="assignee" label="Ответственный">
          <select id="assignee" name="assignee" defaultValue={f.assignee ?? ''} className={inputClass}>
            <option value="">Все</option>
            <option value="me">Мои</option>
            <option value="none">Без ответственного</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="sort" label="Сортировка">
          <select id="sort" name="sort" defaultValue={f.sort} className={inputClass}>
            {Object.entries(SORT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm pb-2">
          <input type="checkbox" name="overdue" value="1" defaultChecked={Boolean(f.overdue)} /> Просрочен контакт
        </label>
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-gradient text-on-brand">
            Найти
          </button>
          <Link href={`/admin/leads?view=${f.view}`} className={linkButtonClass}>
            Сброс
          </Link>
        </div>
      </form>

      {f.view === 'kanban' ? (
        <LeadKanban
          canManage={canManage}
          move={moveLeadAction}
          columns={LEAD_STATUSES.map((s) => ({ status: s, label: LEAD_STATUS_LABELS[s] }))}
          leads={items.map((l) => ({
            id: l.id,
            status: l.status,
            clientName: l.client.name,
            title: l.title,
            expectedAmount: l.expectedAmount,
            nextContact: l.nextContactAt ? formatDateTime(l.nextContactAt) : null,
            overdue: Boolean(l.nextContactAt && l.nextContactAt.getTime() < now && !['WON', 'LOST'].includes(l.status)),
            assignee: l.assignedTo?.name ?? null,
            source: LEAD_SOURCE_LABELS[l.source ?? 'other'] ?? l.source ?? '',
          }))}
        />
      ) : (
        <>
          <div className={`${cardClass} p-0 md:p-0 overflow-x-auto`}>
            {items.length === 0 ? (
              <EmptyState>Лидов нет.</EmptyState>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Лиды</caption>
                <thead className="text-left text-text-secondary border-b border-border-light">
                  <tr>
                    <th scope="col" className="px-4 py-3">Клиент</th>
                    <th scope="col" className="px-4 py-3">Статус</th>
                    <th scope="col" className="px-4 py-3">Источник</th>
                    <th scope="col" className="px-4 py-3 text-right">Ожидаемо</th>
                    <th scope="col" className="px-4 py-3">След. контакт</th>
                    <th scope="col" className="px-4 py-3">Ответственный</th>
                    <th scope="col" className="px-4 py-3">Создан</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {items.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/leads/${l.id}`} className="font-semibold text-brand-ink hover:underline">
                          {l.client.name}
                        </Link>
                        <span className="block text-text-secondary">{l.title ?? formatKzPhone(l.client.normalizedPhone)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={LEAD_STATUS_STYLES[l.status]}>{LEAD_STATUS_LABELS[l.status]}</Badge>
                      </td>
                      <td className="px-4 py-3">{LEAD_SOURCE_LABELS[l.source ?? 'other'] ?? l.source}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatMoney(l.expectedAmount)}</td>
                      <td className={`px-4 py-3 whitespace-nowrap ${l.nextContactAt && l.nextContactAt.getTime() < now && !['WON', 'LOST'].includes(l.status) ? 'text-red-700 font-semibold' : ''}`}>
                        {l.nextContactAt ? formatDateTime(l.nextContactAt) : '—'}
                      </td>
                      <td className="px-4 py-3">{l.assignedTo?.name ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination basePath="/admin/leads" params={searchParams} page={f.page} pages={pages} total={total} />
        </>
      )}

      {canManage && (
        <section className={cardClass} aria-labelledby="new-lead">
          <h2 id="new-lead" className="text-lg font-bold mb-3">
            Новый лид
          </h2>
          <p className="text-sm text-text-secondary mb-3">Если клиент с таким телефоном уже есть, лид будет привязан к нему — дубликат не создаётся.</p>
          <ActionForm action={createLeadAction} resetOnSuccess className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <Field id="nl-name" label="Имя клиента *">
              <input id="nl-name" name="name" required maxLength={100} className={inputClass} />
            </Field>
            <Field id="nl-phone" label="Телефон *">
              <input id="nl-phone" name="phone" type="tel" required maxLength={32} placeholder="+7 700 123 45 67" className={inputClass} />
            </Field>
            <Field id="nl-email" label="Email">
              <input id="nl-email" name="email" type="email" maxLength={254} className={inputClass} />
            </Field>
            <Field id="nl-source" label="Источник">
              <select id="nl-source" name="source" defaultValue="instagram" className={inputClass}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="nl-title" label="Тема">
              <input id="nl-title" name="title" maxLength={120} placeholder="Например: подкаст о бизнесе" className={inputClass} />
            </Field>
            <Field id="nl-amount" label="Ожидаемая сумма, ₸">
              <input id="nl-amount" name="expectedAmount" type="number" min={0} step={1} className={inputClass} />
            </Field>
            <Field id="nl-next" label="Следующий контакт">
              <input id="nl-next" name="nextContactAt" type="datetime-local" className={inputClass} />
            </Field>
            <Field id="nl-assignee" label="Ответственный">
              <select id="nl-assignee" name="assignedToId" defaultValue={user.id} className={inputClass}>
                <option value="">Не назначен</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <Field id="nl-notes" label="Заметки">
                <textarea id="nl-notes" name="notes" rows={2} maxLength={5000} className={inputClass} />
              </Field>
            </div>
            <div>
              <SubmitButton>Создать лид</SubmitButton>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
