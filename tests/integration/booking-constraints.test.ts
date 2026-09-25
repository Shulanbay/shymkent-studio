import { Prisma } from '@prisma/client';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db, truncateAll } from '../support/db';

// Database-level guarantees that back the booking logic of Stage 3.

let roomA: string;
let roomB: string;
let serviceId: string;
let clientId: string;

const t = (hhmm: string) => new Date(`2026-11-20T${hhmm}:00+05:00`);

async function book(roomId: string, start: string, end: string, status: Prisma.BookingCreateInput['status'] = 'REQUESTED', buffer = 15) {
  const startAt = t(start);
  const endAt = t(end);
  return db.booking.create({
    data: {
      client: { connect: { id: clientId } },
      room: { connect: { id: roomId } },
      service: { connect: { id: serviceId } },
      startAt,
      endAt,
      blockedFrom: new Date(startAt.getTime() - buffer * 60_000),
      blockedUntil: new Date(endAt.getTime() + buffer * 60_000),
      participants: 2,
      totalAmount: 40_000,
      status,
    },
  });
}

beforeAll(async () => {
  await db.booking.deleteMany();
  await db.room.deleteMany({ where: { slug: { startsWith: 'test-' } } });
  await db.service.deleteMany({ where: { slug: 'test-pro' } });
  roomA = (await db.room.create({ data: { slug: 'test-a', nameRu: 'A', nameKk: 'A', capacity: 4, color: '#000' } })).id;
  roomB = (await db.room.create({ data: { slug: 'test-b', nameRu: 'B', nameKk: 'B', capacity: 2, color: '#000' } })).id;
  serviceId = (
    await db.service.create({
      data: { slug: 'test-pro', nameRu: 'Pro', nameKk: 'Pro', descriptionRu: '', descriptionKk: '', basePrice: 40_000, defaultDuration: 90, maxDuration: 90 },
    })
  ).id;
});

beforeEach(async () => {
  await truncateAll();
  clientId = (await db.client.create({ data: { name: 'Client', phone: '+7 700 000 00 00', normalizedPhone: '+77000000000' } })).id;
});

const isOverlapError = (e: unknown) => e instanceof Error && /Booking_no_room_overlap|23P01|exclusion/i.test(e.message);

describe('no double booking (PostgreSQL exclusion constraint)', () => {
  it('rejects an overlapping booking in the same room', async () => {
    await book(roomA, '12:00', '13:30');
    await expect(book(roomA, '13:00', '14:00')).rejects.toSatisfy(isOverlapError);
  });

  it('rejects a booking that only overlaps the cleanup buffer', async () => {
    await book(roomA, '12:00', '13:30');
    // 13:30 + 15 min buffer vs 13:40 − 15 min buffer → overlap.
    await expect(book(roomA, '13:40', '15:00')).rejects.toSatisfy(isOverlapError);
  });

  it('allows back-to-back bookings when buffers fit', async () => {
    await book(roomA, '12:00', '13:30');
    await expect(book(roomA, '14:00', '15:30')).resolves.toBeTruthy();
  });

  it('allows the same time in another room', async () => {
    await book(roomA, '12:00', '13:30');
    await expect(book(roomB, '12:00', '13:30')).resolves.toBeTruthy();
  });

  it('ignores cancelled bookings', async () => {
    await book(roomA, '12:00', '13:30', 'CANCELLED');
    await expect(book(roomA, '12:00', '13:30')).resolves.toBeTruthy();
  });

  it('holds under concurrent inserts: exactly one of parallel requests wins', async () => {
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => book(roomA, '16:00', '17:00')));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.booking.count({ where: { roomId: roomA } })).toBe(1);
  });

  it('enforces sane values', async () => {
    await expect(book(roomA, '12:00', '11:00')).rejects.toThrow();
    await expect(
      db.client.create({ data: { name: 'Dup', phone: '8 700 000 00 00', normalizedPhone: '+77000000000' } }),
    ).rejects.toThrow(/Unique constraint/);
  });
});
