import Link from 'next/link';
import type { BookingStatus, Prisma } from '@prisma/client';
import { Badge, EmptyState, Field, PageHeader, cardClass, inputClass, linkButtonClass } from '@/components/admin/ui';
import { layoutOverlaps } from '@/lib/admin/calendar-layout';
import { formatDayLong, formatTime } from '@/lib/admin/format';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES, TOUR_STATUS_LABELS } from '@/lib/admin/labels';
import { hoursForDate } from '@/lib/availability';
import { hasPermission } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatBookingNumber, formatTourNumber } from '@/lib/public/schemas';
import { getWorkingHours } from '@/lib/settings';
import { addDays, isValidDateString, startOfIsoWeek, studioDayRange, timeToMinutes, todayInStudio, utcToZoned } from '@/lib/time';

export const metadata = { title: 'Календарь' };

type View = 'day' | 'week' | 'list';
const PX_PER_MIN = 1.1;
const TOUR_COLOR = '#6B7280';
const ACTIVE_STATUSES: BookingStatus[] = ['REQUESTED', 'CONTACTED', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'];

interface CalendarItem {
  key: string;
  kind: 'booking' | 'tour';
  href: string | null;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  color: string;
  lane: string;
  date: string;
  startMin: number;
  endMin: number;
  start: Date;
  end: Date;
}

export default async function CalendarPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const user = await requirePermission('calendar:view');
  const canOpenBooking = hasPermission(user.role, 'bookings:view');
  const canSeeTours = hasPermission(user.role, 'tours:view');

  const view: View = searchParams.view === 'week' || searchParams.view === 'list' ? searchParams.view : 'day';
  const today = todayInStudio();
  const date = searchParams.date && isValidDateString(searchParams.date) ? searchParams.date : today;
  const roomFilter = searchParams.room || '';
  const statusFilter = searchParams.status || 'active';

  const rangeStart = view === 'day' ? date : startOfIsoWeek(date);
  const days = view === 'day' ? [date] : Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));
  const from = studioDayRange(days[0]).start;
  const to = studioDayRange(days[days.length - 1]).end;

  const statusWhere: Prisma.BookingWhereInput =
    statusFilter === 'all'
      ? {}
      : statusFilter === 'active'
        ? { status: { in: ACTIVE_STATUSES } }
        : { status: statusFilter as BookingStatus };

  const [rooms, bookings, tours, hours] = await Promise.all([
    prisma.room.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.booking.findMany({
      where: { startAt: { gte: from, lt: to }, ...statusWhere, ...(roomFilter ? { room: { slug: roomFilter } } : {}) },
      orderBy: { startAt: 'asc' },
      include: { client: { select: { name: true } }, room: true, service: { select: { nameRu: true } } },
    }),
    canSeeTours && !roomFilter
      ? prisma.tourRequest.findMany({
          where: {
            scheduledAt: { gte: from, lt: to },
            ...(statusFilter === 'all' ? {} : { status: { not: 'CANCELLED' } }),
          },
          orderBy: { scheduledAt: 'asc' },
          include: { client: { select: { name: true } } },
        })
      : Promise.resolve([]),
    getWorkingHours(prisma),
  ]);

  const toItem = (start: Date, end: Date) => {
    const s = utcToZoned(start);
    const e = utcToZoned(end);
    const endMin = e.date === s.date ? timeToMinutes(e.time) : 24 * 60;
    return { date: s.date, startMin: timeToMinutes(s.time), endMin, start, end };
  };

  const items: CalendarItem[] = [
    ...bookings.map((b) => ({
      key: b.id,
      kind: 'booking' as const,
      href: canOpenBooking ? `/admin/bookings/${b.id}` : null,
      title: `${formatBookingNumber(b.bookingNumber)} · ${b.client.name}`,
      subtitle: b.service.nameRu,
      status: b.status,
      statusLabel: BOOKING_STATUS_LABELS[b.status],
      color: b.room.color,
      lane: b.room.slug,
      ...toItem(b.startAt, b.endAt),
    })),
    ...tours.map((t) => ({
      key: t.id,
      kind: 'tour' as const,
      href: `/admin/tours/${t.id}`,
      title: `Тур ${formatTourNumber(t.requestNumber)} · ${t.client.name}`,
      subtitle: 'Бесплатный тур',
      status: t.status,
      statusLabel: TOUR_STATUS_LABELS[t.status],
      color: TOUR_COLOR,
      lane: 'tour',
      ...toItem(t.scheduledAt, t.scheduledEnd),
    })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  // Visible hour range: union of working hours on the shown days and actual items.
  let gridStart = 24 * 60;
  let gridEnd = 0;
  for (const d of days) {
    const h = hoursForDate(hours, d);
    if (h) {
      gridStart = Math.min(gridStart, timeToMinutes(h.open));
      gridEnd = Math.max(gridEnd, timeToMinutes(h.close));
    }
  }
  for (const it of items) {
    gridStart = Math.min(gridStart, it.startMin);
    gridEnd = Math.max(gridEnd, it.endMin);
  }
  if (gridStart >= gridEnd) {
    gridStart = 10 * 60;
    gridEnd = 22 * 60;
  }
  gridStart = Math.floor(gridStart / 60) * 60;
  gridEnd = Math.ceil(gridEnd / 60) * 60;
  const hourMarks = Array.from({ length: (gridEnd - gridStart) / 60 + 1 }, (_, i) => gridStart + i * 60);

  const lanes =
    view === 'day'
      ? [
          ...rooms.filter((r) => !roomFilter || r.slug === roomFilter).map((r) => ({ key: r.slug, label: r.nameRu, color: r.color })),
          ...(canSeeTours && !roomFilter ? [{ key: 'tour', label: 'Туры', color: TOUR_COLOR }] : []),
        ]
      : days.map((d) => ({ key: d, label: formatDayLong(studioDayRange(d).start), color: '' }));

  const link = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ view, date, ...(roomFilter ? { room: roomFilter } : {}), status: statusFilter, ...overrides });
    return `/admin/calendar?${params}`;
  };
  const step = view === 'day' ? 1 : 7;

  // Week view: overlapping blocks within a day are placed side by side; others use the full width.
  const positions = new Map<string, { col: number; cols: number }>();
  if (view === 'week') {
    for (const d of days) {
      for (const [key, pos] of layoutOverlaps(items.filter((i) => i.date === d))) positions.set(key, pos);
    }
  }

  const Block = ({ item }: { item: CalendarItem }) => {
    const pos = positions.get(item.key);
    const horizontal =
      pos && pos.cols > 1
        ? { left: `calc(${(pos.col / pos.cols) * 100}% + 2px)`, width: `calc(${100 / pos.cols}% - 4px)`, right: 'auto' }
        : {};
    const style = {
      ...horizontal,
      top: (item.startMin - gridStart) * PX_PER_MIN,
      height: Math.max(22, (item.endMin - item.startMin) * PX_PER_MIN - 2),
      borderLeftColor: item.color,
      backgroundColor: `${item.color}1A`,
    };
    const content = (
      <>
        <span className="font-semibold block truncate">
          {formatTime(item.start)}–{formatTime(item.end)} {item.title}
        </span>
        <span className="block truncate text-text-secondary">
          {item.subtitle} · {item.statusLabel}
        </span>
      </>
    );
    const className = `absolute left-1 right-1 rounded-md border-l-4 px-2 py-1 text-xs overflow-hidden ${
      item.status === 'CANCELLED' ? 'opacity-50 line-through' : ''
    }`;
    return item.href ? (
      <Link href={item.href} className={`${className} hover:ring-2 hover:ring-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong`} style={style}>
        {content}
      </Link>
    ) : (
      <div className={className} style={style}>
        {content}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Календарь" description="Время по Asia/Almaty. Цвет блока — комната; серым — туры." />

      <div className="flex flex-wrap items-end gap-3 justify-between">
        <nav aria-label="Вид календаря" className="flex gap-1 bg-white border border-border-light rounded-xl p-1">
          {(['day', 'week', 'list'] as const).map((v) => (
            <Link
              key={v}
              href={link({ view: v })}
              aria-current={view === v ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-lg text-sm ${view === v ? 'bg-brand-gradient text-on-brand font-semibold' : 'hover:bg-bg-light'}`}
            >
              {v === 'day' ? 'День' : v === 'week' ? 'Неделя' : 'Список'}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href={link({ date: addDays(date, -step) })} className={linkButtonClass} aria-label="Назад">
            ←
          </Link>
          <Link href={link({ date: today })} className={linkButtonClass}>
            Сегодня
          </Link>
          <Link href={link({ date: addDays(date, step) })} className={linkButtonClass} aria-label="Вперёд">
            →
          </Link>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="view" value={view} />
          <Field id="cal-date" label="Дата">
            <input id="cal-date" name="date" type="date" defaultValue={date} className={inputClass} />
          </Field>
          <Field id="cal-room" label="Комната">
            <select id="cal-room" name="room" defaultValue={roomFilter} className={inputClass}>
              <option value="">Все</option>
              {rooms.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.nameRu}
                </option>
              ))}
            </select>
          </Field>
          <Field id="cal-status" label="Статус">
            <select id="cal-status" name="status" defaultValue={statusFilter} className={inputClass}>
              <option value="active">Все, кроме отменённых</option>
              <option value="all">Все, включая отменённые</option>
              {Object.entries(BOOKING_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-gradient text-on-brand">
            Показать
          </button>
        </form>
      </div>

      <p className="font-semibold">
        {view === 'day'
          ? formatDayLong(studioDayRange(date).start)
          : `${formatDayLong(studioDayRange(days[0]).start)} — ${formatDayLong(studioDayRange(days[6]).start)}`}
      </p>

      <ul className="flex flex-wrap gap-4 text-sm" aria-label="Цвета комнат">
        {rooms.map((r) => (
          <li key={r.slug} className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: r.color }} aria-hidden="true" />
            {r.nameRu}
          </li>
        ))}
        {canSeeTours && (
          <li className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: TOUR_COLOR }} aria-hidden="true" />
            Туры
          </li>
        )}
      </ul>

      {view === 'list' ? (
        <div className={`${cardClass} space-y-6`}>
          {items.length === 0 && <EmptyState>На этой неделе ничего не запланировано.</EmptyState>}
          {days.map((d) => {
            const dayItems = items.filter((i) => i.date === d);
            if (dayItems.length === 0) return null;
            return (
              <section key={d} aria-label={d}>
                <h2 className="text-base font-bold mb-2 capitalize">{formatDayLong(studioDayRange(d).start)}</h2>
                <ul className="divide-y divide-border-light text-sm">
                  {dayItems.map((i) => (
                    <li key={i.key} className="py-2 flex flex-wrap items-center gap-3">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: i.color }} aria-hidden="true" />
                      <span className="w-28 shrink-0 font-semibold">
                        {formatTime(i.start)}–{formatTime(i.end)}
                      </span>
                      {i.href ? (
                        <Link href={i.href} className="hover:underline flex-1 min-w-0">
                          {i.title}
                        </Link>
                      ) : (
                        <span className="flex-1 min-w-0">{i.title}</span>
                      )}
                      <span className="text-text-secondary">{i.subtitle}</span>
                      {i.kind === 'booking' ? (
                        <Badge className={BOOKING_STATUS_STYLES[i.status as BookingStatus]}>{i.statusLabel}</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700">{i.statusLabel}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className={`${cardClass} p-0 md:p-0 overflow-x-auto`}>
          <div className="flex min-w-[720px]">
            <div className="w-14 shrink-0 border-r border-border-light">
              <div className="h-10 border-b border-border-light" />
              <div className="relative" style={{ height: (gridEnd - gridStart) * PX_PER_MIN }}>
                {hourMarks.map((m) => (
                  <span key={m} className="absolute right-2 text-xs text-text-secondary -translate-y-1/2" style={{ top: (m - gridStart) * PX_PER_MIN }}>
                    {String(m / 60).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </div>
            {lanes.map((lane) => {
              const laneItems = items.filter((i) => (view === 'day' ? i.lane === lane.key : i.date === lane.key));
              return (
                <div key={lane.key} className="flex-1 min-w-[140px] border-r border-border-light last:border-r-0">
                  <div className={`h-10 border-b border-border-light px-2 flex items-center gap-2 text-sm font-semibold ${view === 'week' ? 'capitalize' : ''}`}>
                    {lane.color && <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: lane.color }} aria-hidden="true" />}
                    <span className="truncate">{lane.label}</span>
                  </div>
                  <div className="relative" style={{ height: (gridEnd - gridStart) * PX_PER_MIN }}>
                    {hourMarks.map((m) => (
                      <div key={m} className="absolute left-0 right-0 border-t border-border-light/70" style={{ top: (m - gridStart) * PX_PER_MIN }} />
                    ))}
                    {laneItems.map((item) => (
                      <Block key={item.key} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
