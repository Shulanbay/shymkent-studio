import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ActivityList } from '@/components/admin/ActivityList';
import { Badge, Field, cardClass, inputClass, linkButtonClass } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin/format';
import { LEAD_SOURCES, LEAD_STATUSES } from '@/lib/admin/leads';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_STYLES } from '@/lib/admin/labels';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatKzPhone } from '@/lib/phone';
import { formatBookingNumber, formatTourNumber } from '@/lib/public/schemas';
import { utcToZoned } from '@/lib/time';
import { moveLeadFormAction, updateLeadAction } from '../actions';

export const metadata = { title: 'Лид' };

const toLocalInput = (d: Date | null) => {
  if (!d) return '';
  const z = utcToZoned(d);
  return `${z.date}T${z.time}`;
};

export default async function LeadPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await requirePermission('leads:view');
  const canManage = hasPermission(user.role, 'leads:manage');
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      assignedTo: { select: { name: true } },
      booking: { select: { id: true, bookingNumber: true, status: true } },
      tourRequest: { select: { id: true, requestNumber: true, status: true, scheduledAt: true } },
    },
  });
  if (!lead) notFound();
  const [staff, activity] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.activityLog.findMany({
      where: { entityType: 'Lead', entityId: lead.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/admin/leads" className="text-sm text-text-secondary hover:underline">
          ← Все лиды
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold flex flex-wrap items-center gap-3 mt-1">
          {lead.client.name} <Badge className={LEAD_STATUS_STYLES[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
        </h1>
        <p className="text-sm text-text-secondary">
          Создан {formatDateTime(lead.createdAt)} · {LEAD_SOURCE_LABELS[lead.source ?? 'other'] ?? lead.source}
          {lead.closedAt && ` · закрыт ${formatDateTime(lead.closedAt)}`}
        </p>
        {lead.status === 'LOST' && lead.lostReason && <p className="text-sm mt-1">Причина отказа: {lead.lostReason}</p>}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {canManage && (
            <section className={cardClass} aria-labelledby="stage-h">
              <h2 id="stage-h" className="text-lg font-bold mb-3">
                Этап
              </h2>
              <ActionForm action={moveLeadFormAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="leadId" value={lead.id} />
                <Field id="status" label="Новый статус">
                  <select id="status" name="status" defaultValue={lead.status} className={inputClass}>
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex-1 min-w-[12rem]">
                  <Field id="lostReason" label="Причина отказа (обязательно для «Отказ»)">
                    <input id="lostReason" name="lostReason" maxLength={500} className={inputClass} />
                  </Field>
                </div>
                <SubmitButton>Сменить</SubmitButton>
              </ActionForm>
            </section>
          )}

          <section className={cardClass} aria-labelledby="details-h">
            <h2 id="details-h" className="text-lg font-bold mb-3">
              Детали
            </h2>
            <ActionForm action={updateLeadAction} className="grid sm:grid-cols-2 gap-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <Field id="title" label="Тема">
                <input id="title" name="title" defaultValue={lead.title ?? ''} maxLength={120} disabled={!canManage} className={inputClass} />
              </Field>
              <Field id="source" label="Источник">
                <select id="source" name="source" defaultValue={lead.source ?? 'other'} disabled={!canManage} className={inputClass}>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_SOURCE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="expectedAmount" label="Ожидаемая сумма, ₸">
                <input id="expectedAmount" name="expectedAmount" type="number" min={0} step={1} defaultValue={lead.expectedAmount ?? ''} disabled={!canManage} className={inputClass} />
              </Field>
              <Field id="nextContactAt" label="Следующий контакт (время Алматы)">
                <input id="nextContactAt" name="nextContactAt" type="datetime-local" defaultValue={toLocalInput(lead.nextContactAt)} disabled={!canManage} className={inputClass} />
              </Field>
              <Field id="assignedToId" label="Ответственный">
                <select id="assignedToId" name="assignedToId" defaultValue={lead.assignedToId ?? ''} disabled={!canManage} className={inputClass}>
                  <option value="">Не назначен</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field id="notes" label="Внутренние заметки">
                  <textarea id="notes" name="notes" rows={4} maxLength={5000} defaultValue={lead.notes ?? ''} disabled={!canManage} className={inputClass} />
                </Field>
              </div>
              {canManage && (
                <div>
                  <SubmitButton>Сохранить</SubmitButton>
                </div>
              )}
            </ActionForm>
          </section>

          <section className={cardClass} aria-labelledby="hist-h">
            <h2 id="hist-h" className="text-lg font-bold mb-3">
              История
            </h2>
            <ActivityList items={activity} />
          </section>
        </div>

        <div className="space-y-6">
          <section className={cardClass} aria-labelledby="client-h">
            <h2 id="client-h" className="text-lg font-bold mb-2">
              Клиент
            </h2>
            <p className="font-semibold">{lead.client.name}</p>
            <p className="text-sm">{formatKzPhone(lead.client.normalizedPhone)}</p>
            {lead.client.email && <p className="text-sm break-all">{lead.client.email}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={`https://wa.me/${lead.client.normalizedPhone.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className={linkButtonClass}>
                WhatsApp
              </a>
              {hasPermission(user.role, 'clients:view') && (
                <Link href={`/admin/clients/${lead.client.id}`} className={linkButtonClass}>
                  Карточка клиента
                </Link>
              )}
            </div>
          </section>
          <section className={cardClass} aria-labelledby="links-h">
            <h2 id="links-h" className="text-lg font-bold mb-2">
              Связи
            </h2>
            <ul className="text-sm space-y-1">
              <li>
                Тур:{' '}
                {lead.tourRequest ? (
                  <Link href={`/admin/tours/${lead.tourRequest.id}`} className="text-orange-accent hover:underline">
                    {formatTourNumber(lead.tourRequest.requestNumber)} · {formatDateTime(lead.tourRequest.scheduledAt)}
                  </Link>
                ) : (
                  '—'
                )}
              </li>
              <li>
                Заказ:{' '}
                {lead.booking ? (
                  <Link href={`/admin/bookings/${lead.booking.id}`} className="text-orange-accent hover:underline">
                    {formatBookingNumber(lead.booking.bookingNumber)}
                  </Link>
                ) : (
                  '—'
                )}
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
