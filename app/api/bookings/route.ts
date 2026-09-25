import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PublicRequestError } from '@/lib/bookings/shared';
import { createPublicBooking } from '@/lib/bookings/public';
import { prisma } from '@/lib/db';
import { scheduleOutboxProcessing } from '@/lib/outbox/schedule';
import { guardPublicPost, publicError } from '@/lib/public/guard';
import { publicBookingSchema } from '@/lib/public/schemas';
import { log, requestIdOf } from '@/lib/log';

export const dynamic = 'force-dynamic';

// Public booking request. Success is returned only after the booking is
// committed to PostgreSQL; emails / Calendar / Sheets run afterwards from the
// outbox and can never turn a saved booking into an error for the client.
export async function POST(request: NextRequest) {
  const guard = await guardPublicPost(request, 'booking');
  if ('response' in guard) return guard.response;
  const { body, lang } = guard;

  const parsed = publicBookingSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? '')))].filter(Boolean);
    return publicError(fields.includes('phone') ? 'INVALID_PHONE' : 'VALIDATION', lang, { fields });
  }

  try {
    const result = await createPublicBooking(prisma, parsed.data);
    scheduleOutboxProcessing(result.jobIds);
    return NextResponse.json(
      { ok: true, bookingNumber: result.bookingNumber, status: result.booking.status, duplicate: !result.created },
      { status: result.created ? 201 : 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof PublicRequestError) return publicError(error.code, lang);
    log.error('booking.save_failed', { requestId: requestIdOf(request.headers), error });
    return publicError('SERVER', lang);
  }
}
