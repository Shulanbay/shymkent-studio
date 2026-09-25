import Link from 'next/link';
import { Badge, EmptyState, Field, PageHeader, Pagination, cardClass, inputClass, linkButtonClass } from '@/components/admin/ui';
import { formatDate, formatDateTime, formatMoney } from '@/lib/admin/format';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_ENTRY_STATUS_LABELS,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/lib/admin/labels';
import { PAYMENT_METHODS, listDebts, listPayments, paymentFiltersSchema } from '@/lib/admin/payments';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatKzPhone } from '@/lib/phone';
import { formatBookingNumber } from '@/lib/public/schemas';

export const metadata = { title: 'Платежи' };

export default async function PaymentsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  await requirePermission('payments:manage');
  const f = paymentFiltersSchema.parse(searchParams);
  const tabs = [
    ['payments', 'Операции'],
    ['debts', 'Задолженности'],
  ] as const;

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Платежи"
        description="Журнал операций: проведённые записи не редактируются и не удаляются — ошибки исправляются сторнированием."
        actions={
          <nav aria-label="Раздел" className="flex gap-1 bg-white border border-border-light rounded-xl p-1">
            {tabs.map(([v, label]) => (
              <Link
                key={v}
                href={`/admin/payments?view=${v}`}
                aria-current={f.view === v ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm ${f.view === v ? 'bg-orange-accent text-white font-semibold' : 'hover:bg-bg-light'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        }
      />
      <form method="get" role="search" className={`${cardClass} grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 items-end`}>
        <input type="hidden" name="view" value={f.view} />
        <div className="col-span-2">
          <Field id="q" label="Заказ, клиент, телефон">
            <input id="q" name="q" defaultValue={f.q} maxLength={100} className={inputClass} />
          </Field>
        </div>
        {f.view === 'payments' && (
          <>
            <Field id="kind" label="Тип">
              <select id="kind" name="kind" defaultValue={f.kind ?? ''} className={inputClass}>
                <option value="">Все</option>
                {Object.entries(PAYMENT_KIND_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="status" label="Статус">
              <select id="status" name="status" defaultValue={f.status ?? ''} className={inputClass}>
                <option value="">Все</option>
                <option value="PAID">Проведён</option>
                <option value="PENDING">Ожидает</option>
                <option value="FAILED">Не прошёл</option>
              </select>
            </Field>
            <Field id="method" label="Способ">
              <select id="method" name="method" defaultValue={f.method ?? ''} className={inputClass}>
                <option value="">Все</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="from" label="С">
              <input id="from" name="from" type="date" defaultValue={f.from} className={inputClass} />
            </Field>
            <Field id="to" label="По">
              <input id="to" name="to" type="date" defaultValue={f.to} className={inputClass} />
            </Field>
          </>
        )}
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-orange-accent text-white">
            Найти
          </button>
          <Link href={`/admin/payments?view=${f.view}`} className={linkButtonClass}>
            Сброс
          </Link>
        </div>
      </form>

      {f.view === 'payments' ? <PaymentsTable f={f} params={searchParams} /> : <DebtsTable f={f} params={searchParams} />}
    </div>
  );
}

async function PaymentsTable({ f, params }: { f: ReturnType<typeof paymentFiltersSchema.parse>; params: Record<string, string | undefined> }) {
  const { items, total, pages, netSettled } = await listPayments(prisma, f);
  return (
    <>
      <p className="text-sm">
        Итог проведённых операций по фильтру: <strong>{formatMoney(netSettled)}</strong>
      </p>
      <div className={`${cardClass} p-0 md:p-0 overflow-x-auto`}>
        {items.length === 0 ? (
          <EmptyState>Операций нет.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Операции</caption>
            <thead className="text-left text-text-secondary border-b border-border-light">
              <tr>
                <th scope="col" className="px-4 py-3">Дата</th>
                <th scope="col" className="px-4 py-3">Заказ</th>
                <th scope="col" className="px-4 py-3">Операция</th>
                <th scope="col" className="px-4 py-3 text-right">Сумма</th>
                <th scope="col" className="px-4 py-3">Кто провёл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(p.paidAt ?? p.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${p.booking.id}`} className="text-orange-accent hover:underline font-semibold">
                      {formatBookingNumber(p.booking.bookingNumber)}
                    </Link>
                    <span className="block text-xs text-text-secondary">{p.booking.client.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    {PAYMENT_KIND_LABELS[p.kind]} · {PAYMENT_METHOD_LABELS[p.method]}{' '}
                    <Badge className={p.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>{PAYMENT_ENTRY_STATUS_LABELS[p.status]}</Badge>
                    {p.reference && <span className="block text-xs text-text-secondary">№{p.reference}</span>}
                  </td>
                  <td className={`px-4 py-3 text-right whitespace-nowrap font-semibold ${p.signedAmount < 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {p.signedAmount < 0 ? '−' : '+'}
                    {formatMoney(p.amount)}
                  </td>
                  <td className="px-4 py-3">{p.recordedBy?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination basePath="/admin/payments" params={params} page={f.page} pages={pages} total={total} />
    </>
  );
}

async function DebtsTable({ f, params }: { f: ReturnType<typeof paymentFiltersSchema.parse>; params: Record<string, string | undefined> }) {
  const { items, total, pages, outstanding } = await listDebts(prisma, f);
  return (
    <>
      <p className="text-sm">
        Всего к оплате по активным заказам: <strong className="text-red-700">{formatMoney(outstanding)}</strong>
      </p>
      <div className={`${cardClass} p-0 md:p-0 overflow-x-auto`}>
        {items.length === 0 ? (
          <EmptyState>Задолженностей нет.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Задолженности</caption>
            <thead className="text-left text-text-secondary border-b border-border-light">
              <tr>
                <th scope="col" className="px-4 py-3">Заказ</th>
                <th scope="col" className="px-4 py-3">Съёмка</th>
                <th scope="col" className="px-4 py-3 text-right">Стоимость</th>
                <th scope="col" className="px-4 py-3 text-right">Оплачено</th>
                <th scope="col" className="px-4 py-3 text-right">Остаток</th>
                <th scope="col" className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {items.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${b.id}`} className="text-orange-accent hover:underline font-semibold">
                      {formatBookingNumber(b.bookingNumber)}
                    </Link>
                    <span className="block text-xs text-text-secondary">
                      {b.client.name} · {formatKzPhone(b.client.normalizedPhone)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(b.startAt)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatMoney(b.totalAmount)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatMoney(b.paidAmount)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-red-700">{formatMoney(b.totalAmount - b.paidAmount)}</td>
                  <td className="px-4 py-3">
                    {BOOKING_STATUS_LABELS[b.status]}
                    <span className="block text-xs text-text-secondary">{PAYMENT_STATUS_LABELS[b.paymentStatus]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination basePath="/admin/payments" params={params} page={f.page} pages={pages} total={total} />
    </>
  );
}
