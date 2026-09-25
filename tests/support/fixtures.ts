import { hashPassword } from '@/lib/auth/password';
import type { SessionUser } from '@/lib/auth/service';
import type { Role } from '@/lib/auth/permissions';
import { POST as createBooking } from '@/app/api/bookings/route';
import { POST as createTour } from '@/app/api/tours/route';
import { bookingBody, postJson, tourBody } from './api';
import { db } from './db';

export async function makeStaff(role: Role, name = role): Promise<SessionUser> {
  const u = await db.user.create({
    data: { email: `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@example.test`, name, role, passwordHash: await hashPassword('Staff-Password-2026') },
  });
  return { id: u.id, name: u.name, email: u.email, role };
}

export async function publicBooking(overrides: Record<string, unknown> = {}) {
  const res = await createBooking(postJson('/api/bookings', bookingBody(overrides)));
  if (res.status !== 201) throw new Error(`booking failed: ${res.status} ${JSON.stringify(await res.json())}`);
  return db.booking.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
}

export async function publicTour(overrides: Record<string, unknown> = {}) {
  const res = await createTour(postJson('/api/tours', tourBody(overrides)));
  if (res.status !== 201) throw new Error(`tour failed: ${res.status}`);
  return db.tourRequest.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
}
