import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Badge, EmptyState, Field, PageHeader, Pagination, cardClass, inputClass, linkButtonClass } from '@/components/admin/ui';
import { BOOKING_SORTS, bookingFiltersSchema, listBookings } from '@/lib/admin/bookings';
import { formatDate, formatMoney, formatTime } from '@/lib/admin/format';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES, BOOKING_TRANSITIONS, PAYMENT_STATUS_LABELS } from '@/lib/admin/labels';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatKzPhone } from '@/lib/phone';
import { formatBookingNumber } from '@/lib/public/schemas';
import { changeStatusAction } from './actions';

export const metadata = { title: 'Заказы' };

const SORT_LABELS: Record<keyof typeof BOOKING_SORTS, string> = {
  created_desc: 'Сначала новые заявки',
  start_asc: 'По дате съёмки ↑',
  start_desc: 'По дате съёмки ↓',
  amount_desc: 'По сумме ↓',
};

export default async function BookingsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await requirePermission('bookings:view');
  const canManage = hasPermission(user.role, 'bookings:manage');
  const filters = bookingFiltersSchema.parse(searchParams);
  const [{ items, total, pages }, rooms, services] = await Promise.all([
    listBookings(prisma, filters),
    prisma.room.findMany({ orderBy: { sortOrder: 'asc' }, select: { slug: true, nameRu: true } }),
    prisma.service.findMany({ orderBy: { sortOrder: 'asc' }, select: { slug: true, nameRu: true } }),
  ]);

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Заказы" description="Заявки с сайта и бронирования. Время указано по Asia/Almaty." />

      <form method="get" className={`${cardClass} grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 items-end`} role="search">
        <div className="col-span-2">
          <Field id="q" label="Поиск: имя, телефон, № заказа">
            <input id="q" name="q" defaultValue={filters.q} maxLength={100} className={inputClass} placeholder="SS-00012, +7 700…" />
          </Field>
        </div>
        <Field id="status" label="Статус">
          <select id="status" name="status" defaultValue={filters.status ?? ''} className={inputClass}>
            <option value="">Все</option>
            {Object.entries(BOOKING_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field id="room" label="Комната">
          <select id="room" name="room" defaultValue={filters.room ?? ''} className={inputClass}>
            <option value="">Все</option>
            {rooms.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.nameRu}
              </option>
            ))}
          </select>
        </Field>
        <Field id="service" label="Тариф">
          <select id="service" name="service" defaultValue={filters.service ?? ''} className={inputClass}>
            <option value="">Все</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.nameRu}
              </option>
            ))}
          </select>
        </Field>
        <Field id="payment" label="Оплата">
          <select id="payment" name="payment" defaultValue={filters.payment ?? ''} className={inputClass}>
            <option value="">Все</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field id="from" label="Съёмка с">
          <input id="from" name="from" type="date" defaultValue={filters.from} className={inputClass} />
        </Field>
        <Field id="to" label="по">
          <input id="to" name="to" type="date" defaultValue={filters.to} className={inputClass} />
        </Field>
        <Field id="sort" label="Сортировка">
          <select id="sort" name="sort" defaultValue={filters.sort} className={inputClass}>
            {Object.entries(SORT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex gap-2 col-span-2 md:col-span-1">
          <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-orange-accent text-white hover:bg-orange-light">
            Найти
          </button>
          <Link href="/admin/bookings" className={linkButtonClass}>
            Сброс
          </Link>
        </div>
      </form>

      <div className={`${cardClass} p-0 md:p-0 overflow-x-auto`}>
        {items.length === 0 ? (
          <EmptyState>Заказов по этим условиям нет.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Список заказов</caption>
            <thead className="text-left text-text-secondary border-b border-border-light">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">№</th>
                <th scope="col" className="px-4 py-3 font-semibold">Съёмка</th>
                <th scope="col" className="px-4 py-3 font-semibold">Клиент</th>
                <th scope="col" className="px-4 py-3 font-semibold">Комната / тариф</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Сумма</th>
                <th scope="col" className="px-4 py-3 font-semibold">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {items.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-orange-accent hover:underline">
                      {formatBookingNumber(b.bookingNumber)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(b.startAt)}
                    <br />
                    <span className="text-text-secondary">
                      {formatTime(b.startAt)}–{formatTime(b.endAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${b.client.id}`} className="hover:underline">
                      {b.client.name}
                    </Link>
                    <br />
                    <span className="text-text-secondary whitespace-nowrap">{formatKzPhone(b.client.normalizedPhone)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.room.color }} aria-hidden="true" />
                      {b.room.nameRu}
                    </span>
                    <br />
                    <span className="text-text-secondary">{b.service.nameRu}</span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatMoney(b.totalAmount)}
                    <br />
                    <span className="text-text-secondary text-xs">{PAYMENT_STATUS_LABELS[b.paymentStatus]}</span>
                  </td>
                  <td className="px-4 py-3 min-w-[12rem]">
                    <Badge className={BOOKING_STATUS_STYLES[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                    {canManage && BOOKING_TRANSITIONS[b.status].length > 0 && (
                      <ActionForm action={changeStatusAction} className="mt-2 flex gap-2 items-center">
                        <input type="hidden" name="bookingId" value={b.id} />
                        <label htmlFor={`st-${b.id}`} className="sr-only">
                          Новый статус для {formatBookingNumber(b.bookingNumber)}
                        </label>
                        <select id={`st-${b.id}`} name="status" className={`${inputClass} py-1`} defaultValue={BOOKING_TRANSITIONS[b.status][0]}>
                          {BOOKING_TRANSITIONS[b.status].map((s) => (
                            <option key={s} value={s}>
                              {BOOKING_STATUS_LABELS[s]}
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
      <Pagination basePath="/admin/bookings" params={searchParams} page={filters.page} pages={pages} total={total} />
    </div>
  );
}
