/* eslint-disable no-console */
// Seed: owner account, the three studio rooms, the three tariffs and default
// business settings. Idempotent — safe to run repeatedly. Existing rows are
// never overwritten, so changes made in the CRM survive re-seeding.
//
// The owner's credentials come only from the environment:
//   OWNER_EMAIL, OWNER_INITIAL_PASSWORD (used once, when the owner is created), OWNER_NAME (optional)

import { PrismaClient, type Prisma } from '@prisma/client';
import { hashPassword, validatePasswordStrength } from '../lib/auth/password';
import { DEFAULT_CANCELLATION_POLICY } from '../lib/policy';
import { DEFAULT_WORKING_HOURS, SETTING_KEYS } from '../lib/settings-schema';
import { DEFAULT_ROOMS as ROOMS, DEFAULT_SERVICES as SERVICES } from '../lib/catalog-defaults';

const prisma = new PrismaClient();

async function seedOwner() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_INITIAL_PASSWORD;
  const name = process.env.OWNER_NAME?.trim() || 'Владелец';

  if (!email) {
    const owners = await prisma.user.count({ where: { role: 'OWNER' } });
    if (owners > 0) {
      console.log('• owner: OWNER_EMAIL not set, an owner already exists — skipped');
      return;
    }
    throw new Error('OWNER_EMAIL is required to create the first owner');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`• owner: account already exists (role ${existing.role}) — password left unchanged`);
    return;
  }

  if (!password) throw new Error('OWNER_INITIAL_PASSWORD is required to create the owner account');
  const problem = validatePasswordStrength(password);
  if (problem) throw new Error(`OWNER_INITIAL_PASSWORD is too weak: ${problem}`);

  const owner = await prisma.user.create({
    data: { email, name, role: 'OWNER', passwordHash: await hashPassword(password) },
  });
  await prisma.activityLog.create({
    data: { userId: null, entityType: 'User', entityId: owner.id, action: 'seed.owner_created' },
  });
  console.log('• owner: created. Sign in at /admin/login and change the initial password in «Мой аккаунт».');
}

async function seedCatalog() {
  for (const room of ROOMS) {
    await prisma.room.upsert({ where: { slug: room.slug }, create: room, update: {} });
  }
  console.log(`• rooms: ${ROOMS.map((r) => r.slug).join(', ')}`);
  for (const service of SERVICES) {
    await prisma.service.upsert({ where: { slug: service.slug }, create: service, update: {} });
  }
  console.log(`• services: ${SERVICES.map((s) => `${s.slug} ${s.basePrice} ₸`).join(', ')}`);
}

async function seedSettings() {
  const defaults: [string, Prisma.InputJsonValue][] = [
    [SETTING_KEYS.cancellationPolicy, { ...DEFAULT_CANCELLATION_POLICY }],
    [SETTING_KEYS.workingHours, DEFAULT_WORKING_HOURS as unknown as Prisma.InputJsonValue],
  ];
  for (const [key, value] of defaults) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log('• settings: cancellation policy, working hours');
}

async function main() {
  console.log('Seeding SHYMKENT STUDIO database…');
  await seedCatalog();
  await seedSettings();
  await seedOwner();
  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
