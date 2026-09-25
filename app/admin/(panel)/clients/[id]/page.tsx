import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ActivityList } from '@/components/admin/ActivityList';
import { Badge, Field, cardClass, inputClass } from '@/components/admin/ui';
import { findDuplicateCandidates, getClientTotal } from '@/lib/admin/clients';
import { formatDate, formatDateTime, formatMoney, formatTime } from '@/lib/admin/format';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES, TOUR_STATUS_LABELS, TOUR_STATUS_STYLES } from '@/lib/admin/labels';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatKzPhone } from '@/lib/phone';
import { formatBookingNumber, formatTourNumber } from '@/lib/public/schemas';
import { mergeClientAction, updateClientAction } from '../actions';

export const metadata = { title: 'Клиент' };

export default async function ClientDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ merged?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const user = await requirePermission('clients:view');
  const canManage = hasPermission(user.role, 'clients:manage');
  const canMerge = hasPermission(user.role, 'clients:merge');
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      bookings: { orderBy: { startAt: 'desc' }, include: { room: { select: { nameRu: true } }, service: { select: { nameRu: true } } } },
      tourRequests: { orderBy: { scheduledAt: 'desc' } },
    },
  });
  if (!client) notFound();

  const [total, duplicates, activity] = await Promise.all([
    getClientTotal(prisma, client.id),
    canMerge ? findDuplicateCandidates(prisma, client) : Promise.resolve([]),
    prisma.activityLog.findMany({
      where: { entityType: 'Client', entityId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Link href="/admin/clients" className="text-sm text-text-secondary hover:underline">
          ← Все клиенты
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">{client.name}</h1>
        <p className="text-text-secondary text-sm">
          {formatKzPhone(client.normalizedPhone)} · клиент с {formatDate(client.createdAt)} · источник: {client.source ?? '—'}
        </p>
        {searchParams.merged && (
          <p role="status" className="mt-2 text-sm text-green-700">
            Клиенты объединены. История перенесена в эту карточку.
          </p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-4">
        {[
          ['Заказов', client.bookings.length],
          ['Туров', client.tourRequests.length],
          ['Сумма заказов (без отменённых)', formatMoney(total)],
        ].map(([label, value]) => (
          <div key={String(label)} className={cardClass}>
            <dt className="text-xs text-text-secondary">{label}</dt>
            <dd className="text-xl font-bold mt-1">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className={cardClass} aria-labelledby="b-h">
            <h2 id="b-h" className="text-lg font-bold mb-3">
              Заказы
            </h2>
            {client.bookings.length === 0 ? (
              <p className="text-sm text-text-secondary">Заказов нет.</p>
            ) : (
              <ul className="divide-y divide-border-light text-sm">
                {client.bookings.map((b) => (
                  <li key={b.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-orange-accent hover:underline">
                        {formatBookingNumber(b.bookingNumber)}
                      </Link>{' '}
                      {formatDate(b.startAt)} {formatTime(b.startAt)} · {b.room.nameRu} · {b.service.nameRu}
                    </span>
                    <span className="flex items-center gap-2">
                      {formatMoney(b.totalAmount)} <Badge className={BOOKING_STATUS_STYLES[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={cardClass} aria-labelledby="t-h">
            <h2 id="t-h" className="text-lg font-bold mb-3">
              Туры
            </h2>
            {client.tourRequests.length === 0 ? (
              <p className="text-sm text-text-secondary">Туров нет.</p>
            ) : (
              <ul className="divide-y divide-border-light text-sm">
                {client.tourRequests.map((t) => (
                  <li key={t.id} className="py-2 flex flex-wrap justify-between gap-2">
                    <span>
                      <Link href={`/admin/tours/${t.id}`} className="font-semibold text-orange-accent hover:underline">
                        {formatTourNumber(t.requestNumber)}
                      </Link>{' '}
                      {formatDateTime(t.scheduledAt)}
                    </span>
                    <Badge className={TOUR_STATUS_STYLES[t.status]}>{TOUR_STATUS_LABELS[t.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={cardClass} aria-labelledby="h-h">
            <h2 id="h-h" className="text-lg font-bold mb-3">
              История изменений карточки
            </h2>
            <ActivityList items={activity} />
          </section>
        </div>

        <div className="space-y-6">
          <section className={cardClass} aria-labelledby="edit-h">
            <h2 id="edit-h" className="text-lg font-bold mb-3">
              Данные клиента
            </h2>
            <ActionForm action={updateClientAction} className="space-y-3">
              <input type="hidden" name="clientId" value={client.id} />
              <Field id="name" label="Имя">
                <input id="name" name="name" defaultValue={client.name} required maxLength={100} disabled={!canManage} className={inputClass} />
              </Field>
              <Field id="email" label="Email">
                <input id="email" name="email" type="email" defaultValue={client.email ?? ''} maxLength={254} disabled={!canManage} className={inputClass} />
              </Field>
              <Field id="company" label="Компания">
                <input id="company" name="company" defaultValue={client.company ?? ''} maxLength={200} disabled={!canManage} className={inputClass} />
              </Field>
              <Field id="notes" label="Заметки">
                <textarea id="notes" name="notes" rows={5} defaultValue={client.notes ?? ''} maxLength={5000} disabled={!canManage} className={inputClass} />
              </Field>
              <p className="text-xs text-text-secondary">Телефон менять нельзя: по нему клиент определяется при новых заявках.</p>
              {canManage && <SubmitButton>Сохранить</SubmitButton>}
            </ActionForm>
          </section>

          {canMerge && (
            <section className={cardClass} aria-labelledby="dup-h">
              <h2 id="dup-h" className="text-lg font-bold mb-1">
                Возможные дубликаты
              </h2>
              <p className="text-xs text-text-secondary mb-3">Клиенты с тем же именем или email, но другим телефоном.</p>
              {duplicates.length === 0 ? (
                <p className="text-sm text-text-secondary">Не найдено.</p>
              ) : (
                <ul className="space-y-4">
                  {duplicates.map((d) => (
                    <li key={d.id} className="border border-border-light rounded-xl p-3 text-sm">
                      <Link href={`/admin/clients/${d.id}`} className="font-semibold hover:underline">
                        {d.name}
                      </Link>
                      <p className="text-text-secondary">
                        {formatKzPhone(d.normalizedPhone)} · заказов {d._count.bookings}, туров {d._count.tourRequests}
                      </p>
                      <ActionForm action={mergeClientAction} className="mt-2 space-y-2">
                        <input type="hidden" name="targetId" value={client.id} />
                        <input type="hidden" name="sourceId" value={d.id} />
                        <label className="flex items-start gap-2 text-xs">
                          <input type="checkbox" name="confirm" className="mt-0.5" />
                          Перенести историю «{d.name}» в эту карточку и удалить дубликат
                        </label>
                        <SubmitButton variant="danger" confirm="Объединить клиентов? Заказы, туры и лиды перейдут к выбранному клиенту. Отменить объединение нельзя.">Объединить</SubmitButton>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
