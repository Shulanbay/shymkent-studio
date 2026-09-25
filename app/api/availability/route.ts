import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { generateSlots } from '@/lib/availability';
import { loadRoomBusy, loadTourBusy } from '@/lib/bookings/shared';
import { prisma } from '@/lib/db';
import { durationOptions } from '@/lib/pricing';
import { checkPublicRateLimit, publicError } from '@/lib/public/guard';
import { availabilityQuerySchema } from '@/lib/public/schemas';
import { normalizeServiceSlug } from '@/lib/services';
import { getWorkingHours } from '@/lib/settings';
import { log, requestIdOf } from '@/lib/log';

export const dynamic = 'force-dynamic';

// Free start times for a room/tariff/day or for studio tours.
// Returns times only — never who booked what.
export async function GET(request: NextRequest) {
  const limit = await checkPublicRateLimit(request, 'availability');
  if (!limit.allowed) return publicError('RATE_LIMITED', 'ru', { retryAfterSeconds: limit.retryAfterSeconds });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = availabilityQuerySchema.safeParse({ kind: 'booking', ...params });
  if (!parsed.success) return publicError('VALIDATION', 'ru');
  const query = parsed.data;

  try {
    const hours = await getWorkingHours(prisma);
    const now = new Date();
    let slots;
    let durationMinutes: number;

    if (query.kind === 'tour') {
      durationMinutes = hours.tour.durationMinutes;
      slots = generateSlots({
        date: query.date,
        durationMinutes,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        stepMinutes: hours.tour.slotStepMinutes,
        busy: await loadTourBusy(prisma, query.date),
        hours,
        now,
      });
    } else {
      const slug = normalizeServiceSlug(query.service);
      const [service, room] = await Promise.all([
        slug ? prisma.service.findUnique({ where: { slug } }) : null,
        prisma.room.findUnique({ where: { slug: query.room } }),
      ]);
      if (!service?.active) return publicError('SERVICE_UNAVAILABLE', 'ru');
      if (!room?.active) return publicError('ROOM_UNAVAILABLE', 'ru');
      durationMinutes = query.duration ?? service.defaultDuration;
      if (!durationOptions(service).includes(durationMinutes)) return publicError('INVALID_DURATION', 'ru');
      slots = generateSlots({
        date: query.date,
        durationMinutes,
        bufferBeforeMinutes: room.bufferBeforeMinutes,
        bufferAfterMinutes: room.bufferAfterMinutes,
        stepMinutes: hours.slotStepMinutes,
        busy: await loadRoomBusy(prisma, room.id, query.date),
        hours,
        now,
      });
    }

    return NextResponse.json(
      { date: query.date, timeZone: 'Asia/Almaty', durationMinutes, slots },
      // Short shared cache: availability changes when someone books. The form
      // adds a cache-buster after a 409 so a taken slot disappears immediately.
      { headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=20' } },
    );
  } catch (error) {
    log.error('availability.failed', { requestId: requestIdOf(request.headers), error });
    return publicError('SERVER', 'ru');
  }
}
