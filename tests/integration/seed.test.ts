import { execSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { verifyPassword } from '@/lib/auth/password';
import { DEFAULT_CANCELLATION_POLICY } from '@/lib/policy';
import { db, truncateAll } from '../support/db';

const OWNER_EMAIL = 'seed-owner@example.test';
const OWNER_PASSWORD = 'Seed-Owner-Password-2026';

function runSeed(extraEnv: Record<string, string | undefined> = {}) {
  return execSync('npx tsx prisma/seed.ts', {
    env: { ...process.env, OWNER_EMAIL, OWNER_INITIAL_PASSWORD: OWNER_PASSWORD, OWNER_NAME: 'Seed Owner', ...extraEnv },
    stdio: 'pipe',
  }).toString();
}

describe('seed', () => {
  beforeAll(async () => {
    await truncateAll();
    await db.booking.deleteMany();
    await db.room.deleteMany();
    await db.service.deleteMany();
  });

  it('creates the owner, three rooms, three tariffs and default settings', async () => {
    const output = runSeed();
    expect(output).not.toContain(OWNER_PASSWORD);

    const owner = await db.user.findUniqueOrThrow({ where: { email: OWNER_EMAIL } });
    expect(owner.role).toBe('OWNER');
    expect(await verifyPassword(owner.passwordHash, OWNER_PASSWORD)).toBe(true);

    const rooms = await db.room.findMany({ orderBy: { sortOrder: 'asc' } });
    expect(rooms.map((r) => [r.slug, r.capacity])).toEqual([
      ['large', 4],
      ['small', 2],
      ['lounge', 3],
    ]);

    const services = await db.service.findMany({ orderBy: { sortOrder: 'asc' } });
    expect(services.map((s) => [s.slug, s.basePrice])).toEqual([
      ['starter', 20_000],
      ['pro', 40_000],
      ['premium', 60_000],
    ]);

    const policy = await db.setting.findUniqueOrThrow({ where: { key: 'cancellation_policy' } });
    expect(policy.value).toEqual(DEFAULT_CANCELLATION_POLICY);
    expect(await db.setting.findUnique({ where: { key: 'working_hours' } })).not.toBeNull();
  });

  it('is idempotent and never overwrites CRM edits or the owner password', async () => {
    await db.service.update({ where: { slug: 'pro' }, data: { basePrice: 45_000 } });
    runSeed({ OWNER_INITIAL_PASSWORD: 'A-Different-Password-2026' });
    expect((await db.service.findUniqueOrThrow({ where: { slug: 'pro' } })).basePrice).toBe(45_000);
    const owner = await db.user.findUniqueOrThrow({ where: { email: OWNER_EMAIL } });
    expect(await verifyPassword(owner.passwordHash, OWNER_PASSWORD)).toBe(true);
    expect(await db.room.count()).toBe(3);
  });

  it('refuses a weak initial owner password', async () => {
    expect(() => runSeed({ OWNER_EMAIL: 'weak@example.test', OWNER_INITIAL_PASSWORD: 'weak' })).toThrow();
    expect(await db.user.count({ where: { email: 'weak@example.test' } })).toBe(0);
  });
});
