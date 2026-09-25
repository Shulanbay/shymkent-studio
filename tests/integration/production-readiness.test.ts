import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cancelBooking, changeBookingStatus } from '@/lib/admin/bookings';
import { RuleError } from '@/lib/admin/errors';
import { addTaskComment, createTask, listTasks, taskFiltersSchema, updateTask } from '@/lib/admin/production';
import type { SessionUser } from '@/lib/auth/service';
import { checkReadiness } from '@/lib/readiness';
import { useFakeIntegrationEnv } from '../support/api';
import { db, resetCatalog, truncateAll } from '../support/db';
import { makeStaff, publicBooking } from '../support/fixtures';

let manager: SessionUser;
beforeAll(async () => {
  useFakeIntegrationEnv();
  await resetCatalog();
});
beforeEach(async () => {
  await truncateAll();
  manager = await makeStaff('MANAGER');
});

describe('readiness', () => {
  it('is ready with a migrated database and a valid configuration', async () => {
    const r = await checkReadiness(db, { ...process.env, NODE_ENV: 'test' });
    expect(r).toEqual({ ready: true, checks: { database: 'ok', migrations: 'ok', config: 'ok' } });
  });
  it('reports a broken configuration without exposing details', async () => {
    const r = await checkReadiness(db, { ...process.env, NODE_ENV: 'production', AUTH_URL: 'http://localhost:3000' });
    expect(r.ready).toBe(false);
    expect(r.checks.config).toBe('error');
    expect(JSON.stringify(r)).not.toMatch(/AUTH_URL|postgres/);
  });
});

describe('production tasks of cancelled / no-show bookings', () => {
  async function confirmedBooking() {
    const b = await publicBooking({ service: 'pro', duration: 90 });
    await changeBookingStatus(db, manager, { bookingId: b.id, status: 'CONFIRMED' });
    return b;
  }
  const board = async () => (await listTasks(db, taskFiltersSchema.parse({ view: 'list' }), manager)).items;

  it('cancellation removes the tasks from the board and freezes them', async () => {
    const b = await confirmedBooking();
    expect((await board()).length).toBeGreaterThan(0);
    const task = await db.productionTask.findFirstOrThrow({ where: { bookingId: b.id } });

    await cancelBooking(db, manager, { bookingId: b.id, reason: 'Клиент передумал' }, { canOverrideRefund: false });
    expect(await board()).toHaveLength(0);
    await expect(updateTask(db, manager, { taskId: task.id, status: 'DONE' })).rejects.toThrow(RuleError);
    await expect(addTaskComment(db, manager, { taskId: task.id, body: 'x' })).rejects.toThrow(/не ведутся/);
    await expect(createTask(db, manager, { bookingId: b.id, type: 'EDITING', title: 'Новая задача' })).rejects.toThrow(/не ведутся/);
    // Tasks are kept for history, not deleted.
    expect(await db.productionTask.count({ where: { bookingId: b.id } })).toBeGreaterThan(0);
  });

  it('no-show freezes the tasks; returning the booking to CONFIRMED brings them back', async () => {
    const b = await confirmedBooking();
    await changeBookingStatus(db, manager, { bookingId: b.id, status: 'NO_SHOW' });
    expect(await board()).toHaveLength(0);
    await changeBookingStatus(db, manager, { bookingId: b.id, status: 'CONFIRMED' });
    expect((await board()).length).toBeGreaterThan(0);
  });
});
