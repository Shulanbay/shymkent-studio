import Link from 'next/link';
import { EmptyState, Field, PageHeader, Pagination, cardClass, inputClass, linkButtonClass } from '@/components/admin/ui';
import { clientFiltersSchema, listClients } from '@/lib/admin/clients';
import { formatDate, formatMoney } from '@/lib/admin/format';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatKzPhone } from '@/lib/phone';

export const metadata = { title: 'Клиенты' };

export default async function ClientsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  await requirePermission('clients:view');
  const filters = clientFiltersSchema.parse(searchParams);
  const { items, total, pages } = await listClients(prisma, filters);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Клиенты" description="Один клиент на один номер телефона: повторные заявки попадают в существующую карточку." />
      <form method="get" role="search" className={`${cardClass} flex flex-wrap items-end gap-3`}>
        <div className="flex-1 min-w-[14rem]">
          <Field id="q" label="Поиск: имя, телефон, email, компания">
            <input id="q" name="q" defaultValue={filters.q} maxLength={100} className={inputClass} />
          </Field>
        </div>
        <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-orange-accent text-white">
          Найти
        </button>
        <Link href="/admin/clients" className={linkButtonClass}>
          Сброс
        </Link>
      </form>

      <div className={`${cardClass} p-0 md:p-0 overflow-x-auto`}>
        {items.length === 0 ? (
          <EmptyState>Клиентов не найдено.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Клиенты</caption>
            <thead className="text-left text-text-secondary border-b border-border-light">
              <tr>
                <th scope="col" className="px-4 py-3">Клиент</th>
                <th scope="col" className="px-4 py-3">Телефон</th>
                <th scope="col" className="px-4 py-3 text-right">Заказов</th>
                <th scope="col" className="px-4 py-3 text-right">Туров</th>
                <th scope="col" className="px-4 py-3 text-right">Сумма заказов</th>
                <th scope="col" className="px-4 py-3">С нами с</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${c.id}`} className="font-semibold text-orange-accent hover:underline">
                      {c.name}
                    </Link>
                    {c.company && <span className="block text-text-secondary">{c.company}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatKzPhone(c.normalizedPhone)}</td>
                  <td className="px-4 py-3 text-right">{c._count.bookings}</td>
                  <td className="px-4 py-3 text-right">{c._count.tourRequests}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatMoney(c.totalAmount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination basePath="/admin/clients" params={searchParams} page={filters.page} pages={pages} total={total} />
    </div>
  );
}
