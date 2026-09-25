import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PublicRequestError } from '@/lib/bookings/shared';
import { prisma } from '@/lib/db';
import { scheduleOutboxProcessing } from '@/lib/outbox/schedule';
import { guardPublicPost, publicError } from '@/lib/public/guard';
import { publicTourSchema } from '@/lib/public/schemas';
import { createPublicTour } from '@/lib/tours/public';
import { log, requestIdOf } from '@/lib/log';

export const dynamic = 'force-dynamic';

// Free studio tour request. Saved to PostgreSQL before success is returned.
export async function POST(request: NextRequest) {
  const guard = await guardPublicPost(request, 'tour');
  if ('response' in guard) return guard.response;
  const { body, lang } = guard;

  const parsed = publicTourSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? '')))].filter(Boolean);
    return publicError(fields.includes('phone') ? 'INVALID_PHONE' : 'VALIDATION', lang, { fields });
  }

  try {
    const result = await createPublicTour(prisma, parsed.data);
    scheduleOutboxProcessing(result.jobIds);
    return NextResponse.json(
      { ok: true, requestNumber: result.requestNumber, duplicate: !result.created },
      { status: result.created ? 201 : 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof PublicRequestError) return publicError(error.code, lang);
    log.error('tour.save_failed', { requestId: requestIdOf(request.headers), error });
    return publicError('SERVER', lang);
  }
}
