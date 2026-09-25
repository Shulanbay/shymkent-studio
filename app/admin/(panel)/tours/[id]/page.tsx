import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ActivityList } from '@/components/admin/ActivityList';
import { Badge, cardClass, inputClass, linkButtonClass } from '@/components/admin/ui';
import { formatDate, formatDateTime, formatTime } from '@/lib/admin/format';
import { TOUR_FORMAT_LABELS, TOUR_STATUS_LABELS, TOUR_STATUS_STYLES, TOUR_TRANSITIONS } from '@/lib/admin/labels';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatKzPhone } from '@/lib/phone';
import { formatTourNumber } from '@/lib/public/schemas';
import { rescheduleTourAction, tourNotesAction, tourStatusAction } from '../actions';
import { generateSlots } from '@/lib/availability';
import { loadTourBusy } from '@/lib/bookings/shared';
import { getWorkingHours } from '@/lib/settings';
import { todayInStudio } from '@/lib/time';
import { Field } from '@/components/admin/ui';

export const metadata = { title: 'Тур' };

export default async function TourDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ rd?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const user = await requirePermission('tours:view');
  const canManage = hasPermission(user.role, 'tours:manage');
  const canSeeClients = hasPermission(user.role, 'clients:view');
  const tour = await prisma.tourRequest.findUnique({ where: { id: params.id }, include: { client: true } });
  if (!tour) notFound();
  const rescheduleDate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.rd ?? '') ? searchParams.rd! : undefined;
  const canReschedule = canManage && (tour.status === 'NEW' || tour.status === 'CONFIRMED');
  let slots: { time: string }[] = [];
  if (canReschedule && rescheduleDate) {
    const hours = await getWorkingHours(prisma);
    slots = generateSlots({
      date: rescheduleDate,
      durationMinutes: hours.tour.durationMinutes,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      stepMinutes: hours.tour.slotStepMinutes,
      busy: await loadTourBusy(prisma, rescheduleDate, tour.id),
      hours,
      now: new Date(),
      ignoreLeadAndHorizon: true,
    });
  }
  const activity = await prisma.activityLog.findMany({
    where: { entityType: 'TourRequest', entityId: tour.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/admin/tours" className="text-sm text-text-secondary hover:underline">
          ← Все туры
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold flex flex-wrap items-center gap-3 mt-1">
          Тур {formatTourNumber(tour.requestNumber)} <Badge className={TOUR_STATUS_STYLES[tour.status]}>{TOUR_STATUS_LABELS[tour.status]}</Badge>
        </h1>
        <p className="text-text-secondary text-sm mt-1">Заявка создана {formatDateTime(tour.createdAt)}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className={cardClass} aria-labelledby="when-h">
          <h2 id="when-h" className="text-lg font-bold mb-3">
            Когда
          </h2>
          <p className="font-semibold">
            {formatDate(tour.scheduledAt)}, {formatTime(tour.scheduledAt)}–{formatTime(tour.scheduledEnd)}
          </p>
          <p className="text-sm text-text-secondary">Формат: {tour.format ? TOUR_FORMAT_LABELS[tour.format] ?? tour.format : 'не указан'}</p>
          <p className="text-sm text-text-secondary">Согласие на обработку данных: {formatDateTime(tour.consentAt)}</p>
          {canManage && TOUR_TRANSITIONS[tour.status].length > 0 && (
            <ActionForm action={tourStatusAction} className="flex flex-wrap gap-2 mt-4">
              <input type="hidden" name="tourId" value={tour.id} />
              {TOUR_TRANSITIONS[tour.status].map((s) => (
                <button
                  key={s}
                  type="submit"
                  name="status"
                  value={s}
                  className="px-3 py-1.5 rounded-xl text-sm font-semibold border border-border-light bg-white hover:border-orange-accent"
                >
                  → {TOUR_STATUS_LABELS[s]}
                </button>
              ))}
            </ActionForm>
          )}
        </section>

        <section className={cardClass} aria-labelledby="client-h">
          <h2 id="client-h" className="text-lg font-bold mb-3">
            Клиент
          </h2>
          <p className="font-semibold">{tour.client.name}</p>
          <p className="text-sm">{formatKzPhone(tour.client.normalizedPhone)}</p>
          <p className="text-sm text-text-secondary">Язык: {tour.locale === 'KK' ? 'казахский' : 'русский'}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <a
              href={`https://wa.me/${tour.client.normalizedPhone.replace('+', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className={linkButtonClass}
            >
              WhatsApp
            </a>
            {canSeeClients && (
              <Link href={`/admin/clients/${tour.client.id}`} className={linkButtonClass}>
                Карточка клиента
              </Link>
            )}
          </div>
        </section>
      </div>

      {canReschedule && (
        <section className={cardClass} aria-labelledby="resched-h">
          <h2 id="resched-h" className="text-lg font-bold mb-1">
            Перенос тура
          </h2>
          <p className="text-sm text-text-secondary mb-3">Туры не пересекаются друг с другом; записи в комнатах на туры не влияют.</p>
          <form method="get" className="flex flex-wrap items-end gap-2 mb-3">
            <Field id="rd" label="Новая дата">
              <input id="rd" name="rd" type="date" defaultValue={rescheduleDate ?? todayInStudio()} className={inputClass} />
            </Field>
            <button type="submit" className={linkButtonClass}>
              Показать время
            </button>
          </form>
          {rescheduleDate &&
            (slots.length === 0 ? (
              <p className="text-sm text-text-secondary">Свободного времени нет.</p>
            ) : (
              <ActionForm action={rescheduleTourAction}>
                <input type="hidden" name="tourId" value={tour.id} />
                <input type="hidden" name="date" value={rescheduleDate} />
                <fieldset>
                  <legend className="text-xs font-semibold mb-2">Время на {rescheduleDate}</legend>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                    {slots.map((slot) => (
                      <label
                        key={slot.time}
                        className="text-center py-1.5 border border-border-light rounded-lg text-sm cursor-pointer has-[:checked]:bg-orange-accent has-[:checked]:text-white focus-within:ring-2 focus-within:ring-orange-accent"
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
          Заметки
        </h2>
        <ActionForm action={tourNotesAction} className="space-y-3">
          <input type="hidden" name="tourId" value={tour.id} />
          <label htmlFor="notes" className="sr-only">
            Заметки
          </label>
          <textarea id="notes" name="notes" rows={4} maxLength={5000} defaultValue={tour.notes ?? ''} disabled={!canManage} className={inputClass} />
          {canManage && <SubmitButton>Сохранить</SubmitButton>}
        </ActionForm>
      </section>

      <section className={cardClass} aria-labelledby="hist-h">
        <h2 id="hist-h" className="text-lg font-bold mb-3">
          История
        </h2>
        <ActivityList items={activity} />
      </section>
    </div>
  );
}
