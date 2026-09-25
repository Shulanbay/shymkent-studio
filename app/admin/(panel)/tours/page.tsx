import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Badge, EmptyState, Field, PageHeader, Pagination, cardClass, inputClass, linkButtonClass } from '@/components/admin/ui';
import { formatDate, formatDateTime, formatTime } from '@/lib/admin/format';
import { TOUR_FORMAT_LABELS, TOUR_STATUS_LABELS, TOUR_STATUS_STYLES, TOUR_TRANSITIONS } from '@/lib/admin/labels';
import { listTours, tourFiltersSchema } from '@/lib/admin/tours';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatKzPhone } from '@/lib/phone';
import { formatTourNumber } from '@/lib/public/schemas';
import { tourStatusAction } from './actions';

export const metadata = { title: 'Туры' };

export default async function ToursPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await requirePermission('tours:view');
  const canManage = hasPermission(user.role, 'tours:manage');
  const canSeeClients = hasPermission(user.role, 'clients:view');
  const filters = tourFiltersSchema.parse(searchParams);
  const { items, total, pages } = await listTours(prisma, filters);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Бесплатные туры" description="Заявки на экскурсию по студии. Время по Asia/Almaty." />

      <form method="get" role="search" className={`${cardClass} grid grid-cols-2 md:grid-cols-5 gap-3 items-end`}>
        <div className="col-span-2">
          <Field id="q" label="Поиск: имя, телефон, № заявки">
            <input id="q" name="q" defaultValue={filters.q} maxLength={100} className={inputClass} placeholder="T-00003, Айгерим…" />
          </Field>
        </div>
        <Field id="status" label="Статус">
          <select id="status" name="status" defaultValue={filters.status ?? ''} className={inputClass}>
            <option value="">Все</option>
            {Object.entries(TOUR_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field id="from" label="С">
          <input id="from" name="from" type="date" defaultValue={filters.from} className={inputClass} />
        </Field>
        <Field id="to" label="По">
          <input id="to" name="to" type="date" defaultValue={filters.to} className={inputClass} />
        </Field>
        <div className="flex gap-2 col-span-2 md:col-span-5">
          <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-orange-accent text-white">
            Найти
          </button>
          <Link href="/admin/tours" className={linkButtonClass}>
            Сброс
          </Link>
        </div>
      </form>

      <div className={`${cardClass} p-0 md:p-0 overflow-x-auto`}>
        {items.length === 0 ? (
          <EmptyState>Заявок на тур нет.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Заявки на тур</caption>
            <thead className="text-left text-text-secondary border-b border-border-light">
              <tr>
                <th scope="col" className="px-4 py-3">№</th>
                <th scope="col" className="px-4 py-3">Когда</th>
                <th scope="col" className="px-4 py-3">Клиент</th>
                <th scope="col" className="px-4 py-3">Формат</th>
                <th scope="col" className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {items.map((t) => (
                <tr key={t.id} className="align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/tours/${t.id}`} className="font-semibold text-orange-accent hover:underline">
                      {formatTourNumber(t.requestNumber)}
                    </Link>
                    <br />
                    <span className="text-xs text-text-secondary">создана {formatDateTime(t.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(t.scheduledAt)}
                    <br />
                    <span className="text-text-secondary">
                      {formatTime(t.scheduledAt)}–{formatTime(t.scheduledEnd)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canSeeClients ? (
                      <Link href={`/admin/clients/${t.client.id}`} className="hover:underline">
                        {t.client.name}
                      </Link>
                    ) : (
                      t.client.name
                    )}
                    <br />
                    <span className="text-text-secondary whitespace-nowrap">{formatKzPhone(t.client.normalizedPhone)}</span>
                  </td>
                  <td className="px-4 py-3">{t.format ? TOUR_FORMAT_LABELS[t.format] ?? t.format : '—'}</td>
                  <td className="px-4 py-3 min-w-[12rem]">
                    <Badge className={TOUR_STATUS_STYLES[t.status]}>{TOUR_STATUS_LABELS[t.status]}</Badge>
                    {canManage && TOUR_TRANSITIONS[t.status].length > 0 && (
                      <ActionForm action={tourStatusAction} className="mt-2 flex gap-2 items-center">
                        <input type="hidden" name="tourId" value={t.id} />
                        <label htmlFor={`ts-${t.id}`} className="sr-only">
                          Новый статус
                        </label>
                        <select id={`ts-${t.id}`} name="status" className={`${inputClass} py-1`}>
                          {TOUR_TRANSITIONS[t.status].map((s) => (
                            <option key={s} value={s}>
                              {TOUR_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                        <SubmitButton variant="secondary" pendingLabel="…">
                          OK
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination basePath="/admin/tours" params={searchParams} page={filters.page} pages={pages} total={total} />
    </div>
  );
}
