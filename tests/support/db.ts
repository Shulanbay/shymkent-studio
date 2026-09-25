import { PrismaClient } from '@prisma/client';
import { DEFAULT_ROOMS, DEFAULT_SERVICES } from '@/lib/catalog-defaults';

export const db = new PrismaClient();

/** Removes rows created by a test file (catalog is kept). */
export async function truncateAll() {
  await db.$executeRawUnsafe(
    'TRUNCATE "ActivityLog", "Session", "RateLimit", "IntegrationJob", "Payment", "ProductionTask", "Booking", "TourRequest", "Lead", "Client", "User", "Setting" RESTART IDENTITY CASCADE',
  );
}

/** Resets rooms and tariffs to the published defaults (other test files may have edited them). */
export async function resetCatalog() {
  for (const room of DEFAULT_ROOMS) {
    const { slug, ...rest } = room;
    await db.room.upsert({ where: { slug }, create: room, update: { ...rest, active: true } });
  }
  for (const service of DEFAULT_SERVICES) {
    const { slug, ...rest } = service;
    await db.service.upsert({
      where: { slug },
      create: service,
      update: { ...rest, extraStepMinutes: rest.extraStepMinutes ?? null, extraStepPrice: rest.extraStepPrice ?? null, active: true },
    });
  }
}
