import Link from 'next/link';
import { ActivityList } from '@/components/admin/ActivityList';
import { Badge, Field, cardClass, inputClass } from '@/components/admin/ui';
import { formatDateTime, formatMoney, formatTime } from '@/lib/admin/format';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES, TOUR_STATUS_LABELS, TOUR_STATUS_STYLES } from '@/lib/admin/labels';
import {
  leadStats,
  percentChange,
  popularServices,
  previousPeriod,
  receivables,
  repeatClients,
  resolvePeriod,
  revenue,
  roomUtilization,
} from '@/lib/admin/metrics';
import { INACTIVE_BOOKING_STATUSES } from '@/lib/admin/production';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatBookingNumber, formatTourNumber } from '@/lib/public/schemas';
import { getWorkingHours } from '@/lib/settings';
import { addDays, studioDayRange, todayInStudio } from '@/lib/time';

export const metadata = { title: 'Обзор' };

const PERIODS = [
  ['today', 'Сегодня'],
  ['7d', '7 дней'],
  ['30d', '30 дней'],
  ['month', 'Текущий месяц'],
  ['prev_month', 'Прошлый месяц'],
  ['custom', 'Свой период'],
] as const;

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-text-secondary">нет данных для сравнения</span>;
  const sign = value > 0 ? '+' : '';
  return <span className={`text-xs font-semibold ${value > 0 ? 'text-green-700' : value < 0 ? 'text-red-700' : 'text-text-secondary'}`}>{`${sign}${value}% к прошлому периоду`}</span>;
}

function Kpi({ label, value, href, sub, alert }: { label: string; value: string | number; href?: string; sub?: React.ReactNode; alert?: boolean }) {
  const inner = (
    <>
      <dt className="text-xs sm:text-sm text-text-secondary">{label}</dt>
      <dd className={`text-2xl sm:text-3xl font-bold mt-1 ${alert ? 'text-red-700' : ''}`}>{value}</dd>
      {sub && <dd className="mt-1">{sub}</dd>}
    </>
  );
  return href ? (
    <Link href={href} className={`${cardClass} block hover:border-brand`}>
      {inner}
    </Link>
  ) : (
    <div className={cardClass}>{inner}</div>
  );
}

export default async function AdminDashboardPage(props: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requirePermission('dashboard:view');
  const can = {
    money: hasPermission(user.role, 'payments:manage'),
    leads: hasPermission(user.role, 'leads:view'),
    bookings: hasPermission(user.role, 'bookings:view'),
    calendar: hasPermission(user.role, 'calendar:view'),
    tours: hasPermission(user.role, 'tours:view'),
    production: hasPermission(user.role, 'production:view'),
    integrations: hasPermission(user.role, 'integrations:view'),
    activity: hasPermission(user.role, 'activity:view'),
  };
  const period = resolvePeriod(searchParams);
  const prev = previousPeriod(period);
  const now = new Date();
  const today = todayInStudio(now);
  const todayRange = studioDayRange(today);
  const thisMonth = resolvePeriod({ period: 'month' }, now);
  const lastMonth = resolvePeriod({ period: 'prev_month' }, now);
  const hours = await getWorkingHours(prisma);
  const skip = <T,>(value: T) => Promise.resolve(value);

  const [
    periodRevenue,
    prevRevenue,
    monthRevenue,
    lastMonthRevenue,
    debts,
    leads,
    prevLeads,
    newRequests,
    awaiting,
    todayShoots,
    upcomingTours,
    overdueTasks,
    utilization,
    repeat,
    services,
    failedJobs,
    activity,
    completedShoots,
  ] = await Promise.all([
    can.money ? revenue(prisma, period.from, period.to) : skip(null),
    can.money ? revenue(prisma, prev.from, prev.to) : skip(null),
    can.money ? revenue(prisma, thisMonth.from, thisMonth.to) : skip(null),
    can.money ? revenue(prisma, lastMonth.from, lastMonth.to) : skip(null),
    can.money ? receivables(prisma) : skip(null),
    can.leads ? leadStats(prisma, period) : skip(null),
    can.leads ? leadStats(prisma, prev) : skip(null),
    can.bookings ? prisma.booking.count({ where: { status: 'REQUESTED' } }) : skip(0),
    can.bookings ? prisma.booking.count({ where: { status: { in: ['REQUESTED', 'CONTACTED', 'PENDING_PAYMENT'] }, startAt: { gte: now } } }) : skip(0),
    can.calendar
      ? prisma.booking.findMany({
          where: { startAt: { gte: todayRange.start, lt: todayRange.end }, status: { not: 'CANCELLED' } },
          orderBy: { startAt: 'asc' },
          include: { client: { select: { name: true } }, room: { select: { nameRu: true, color: true } } },
        })
      : skip([]),
    can.tours
      ? prisma.tourRequest.findMany({
          where: { scheduledAt: { gte: now, lt: studioDayRange(addDays(today, 7)).end }, status: { in: ['NEW', 'CONFIRMED'] } },
          orderBy: { scheduledAt: 'asc' },
          take: 8,
          include: { client: { select: { name: true } } },
        })
      : skip([]),
    can.production ? prisma.productionTask.count({ where: { status: { not: 'DONE' }, dueAt: { lt: now }, booking: { status: { notIn: [...INACTIVE_BOOKING_STATUSES] } } } }) : skip(0),
    can.calendar ? roomUtilization(prisma, period, hours) : skip([]),
    can.bookings ? repeatClients(prisma, period) : skip(null),
    can.bookings ? popularServices(prisma, period) : skip([]),
    can.integrations ? prisma.integrationJob.count({ where: { status: 'FAILED' } }) : skip(0),
    can.activity ? prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 12, include: { user: { select: { name: true } } } }) : skip([]),
    can.bookings ? prisma.booking.count({ where: { status: 'COMPLETED', startAt: { gte: period.from, lt: period.to } } }) : skip(0),
  ]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Здравствуйте, {user.name}</h1>
          <p className="text-text-secondary mt-1 text-sm">
            {period.label}: {period.firstDay} — {period.lastDay} (Asia/Almaty)
          </p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Период">
          <Field id="period" label="Период">
            <select id="period" name="period" defaultValue={period.key} className={inputClass}>
              {PERIODS.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field id="from" label="С">
            <input id="from" name="from" type="date" defaultValue={period.key === 'custom' ? period.firstDay : ''} className={inputClass} />
          </Field>
          <Field id="to" label="По">
            <input id="to" name="to" type="date" defaultValue={period.key === 'custom' ? period.lastDay : ''} className={inputClass} />
          </Field>
          <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-gradient text-on-brand">
            Показать
          </button>
        </form>
      </div>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {can.leads && leads && prevLeads && (
          <Kpi label="Новые лиды за период" value={leads.total} href="/admin/leads" sub={<Change value={percentChange(leads.total, prevLeads.total)} />} />
        )}
        {can.bookings && <Kpi label="Новые заявки" value={newRequests} href="/admin/bookings?status=REQUESTED" />}
        {can.bookings && <Kpi label="Ждут подтверждения или оплаты" value={awaiting} href="/admin/bookings" />}
        {can.calendar && <Kpi label="Съёмок сегодня" value={todayShoots.length} href="/admin/calendar" />}
        {can.bookings && <Kpi label="Завершено съёмок за период" value={completedShoots} href="/admin/bookings?status=COMPLETED" />}
        {can.money && periodRevenue && prevRevenue && (
          <Kpi
            label="Выручка за период"
            value={formatMoney(periodRevenue.net)}
            href="/admin/payments"
            sub={
              <>
                <Change value={percentChange(periodRevenue.net, prevRevenue.net)} />
                {periodRevenue.outgoing > 0 && <span className="block text-xs text-text-secondary">возвраты и сторно: −{formatMoney(periodRevenue.outgoing)}</span>}
              </>
            }
          />
        )}
        {can.money && monthRevenue && lastMonthRevenue && (
          <Kpi
            label="Выручка: текущий / прошлый месяц"
            value={formatMoney(monthRevenue.net)}
            sub={<span className="text-xs text-text-secondary">прошлый месяц: {formatMoney(lastMonthRevenue.net)}</span>}
          />
        )}
        {can.money && debts && (
          <Kpi
            label="Не оплачено / частично"
            value={`${debts.unpaid} / ${debts.partial}`}
            href="/admin/payments?view=debts"
            sub={<span className="text-xs text-text-secondary">к получению: {formatMoney(debts.outstanding)}</span>}
            alert={debts.outstanding > 0}
          />
        )}
        {can.production && <Kpi label="Просроченные задачи" value={overdueTasks} href="/admin/production?due=overdue&view=list" alert={overdueTasks > 0} />}
        {can.leads && leads && (
          <Kpi
            label="Конверсия лидов"
            value={leads.conversion === null ? '—' : `${leads.conversion}%`}
            sub={<span className="text-xs text-text-secondary">успешно {leads.won} из {leads.total}, отказ {leads.lost}</span>}
          />
        )}
        {can.bookings && repeat && (
          <Kpi
            label="Повторные клиенты"
            value={repeat.percent === null ? '—' : `${repeat.percent}%`}
            sub={<span className="text-xs text-text-secondary">{repeat.repeat} из {repeat.total} клиентов периода</span>}
          />
        )}
        {can.integrations && <Kpi label="Ошибки интеграций" value={failedJobs} href="/admin/integrations" alert={failedJobs > 0} />}
      </dl>

      <div className="grid lg:grid-cols-2 gap-6">
        {can.calendar && (
          <section className={cardClass} aria-labelledby="util-h">
            <h2 id="util-h" className="text-lg font-bold mb-3">
              Загрузка комнат за период
            </h2>
            <ul className="space-y-3">
              {utilization.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex justify-between">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} aria-hidden="true" />
                      {r.nameRu}
                    </span>
                    <span className="text-text-secondary">
                      {r.percent === null ? '—' : `${r.percent}%`} · {Math.round(r.bookedMinutes / 60)} из {Math.round(r.openMinutes / 60)} ч
                    </span>
                  </div>
                  <div className="h-2 bg-bg-light rounded-full mt-1 overflow-hidden" role="presentation">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.percent ?? 0)}%`, backgroundColor: r.color }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {can.bookings && (
          <section className={cardClass} aria-labelledby="services-h">
            <h2 id="services-h" className="text-lg font-bold mb-3">
              Популярные тарифы за период
            </h2>
            {services.length === 0 ? (
              <p className="text-sm text-text-secondary">Заказов за период нет.</p>
            ) : (
              <ul className="divide-y divide-border-light text-sm">
                {services.map((s) => (
                  <li key={s.name} className="py-2 flex justify-between gap-2">
                    <span>{s.name}</span>
                    <span className="text-text-secondary whitespace-nowrap">
                      {s.count} зак. · {formatMoney(s.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {can.calendar && (
          <section className={cardClass} aria-labelledby="today-h">
            <h2 id="today-h" className="text-lg font-bold mb-3">
              Съёмки сегодня
            </h2>
            {todayShoots.length === 0 ? (
              <p className="text-sm text-text-secondary">Сегодня съёмок нет.</p>
            ) : (
              <ul className="divide-y divide-border-light text-sm">
                {todayShoots.map((b) => (
                  <li key={b.id} className="py-2 flex flex-wrap items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.room.color }} aria-hidden="true" />
                    <span className="font-semibold w-24">
                      {formatTime(b.startAt)}–{formatTime(b.endAt)}
                    </span>
                    {can.bookings ? (
                      <Link href={`/admin/bookings/${b.id}`} className="flex-1 hover:underline min-w-0">
                        {formatBookingNumber(b.bookingNumber)} · {b.client.name} · {b.room.nameRu}
                      </Link>
                    ) : (
                      <span className="flex-1">
                        {b.client.name} · {b.room.nameRu}
                      </span>
                    )}
                    <Badge className={BOOKING_STATUS_STYLES[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {can.tours && (
          <section className={cardClass} aria-labelledby="tours-h">
            <h2 id="tours-h" className="text-lg font-bold mb-3">
              Ближайшие туры (7 дней)
            </h2>
            {upcomingTours.length === 0 ? (
              <p className="text-sm text-text-secondary">Запланированных туров нет.</p>
            ) : (
              <ul className="divide-y divide-border-light text-sm">
                {upcomingTours.map((t) => (
                  <li key={t.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/admin/tours/${t.id}`} className="hover:underline">
                      {formatDateTime(t.scheduledAt)} · {formatTourNumber(t.requestNumber)} · {t.client.name}
                    </Link>
                    <Badge className={TOUR_STATUS_STYLES[t.status]}>{TOUR_STATUS_LABELS[t.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {can.activity && (
        <section aria-labelledby="activity-heading" className={cardClass}>
          <h2 id="activity-heading" className="text-lg font-bold mb-4">
            Последние действия
          </h2>
          <ActivityList items={activity} />
        </section>
      )}
    </div>
  );
}
