import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { changeBookingStatus, rescheduleBooking } from '@/lib/admin/bookings';
import { RuleError } from '@/lib/admin/errors';
import { addTaskComment, createTask, createTasksForBooking, updateTask } from '@/lib/admin/production';
import type { SessionUser } from '@/lib/auth/service';
import { DEFAULT_PRODUCTION_TEMPLATES } from '@/lib/settings-schema';
import { futureDay, useFakeIntegrationEnv } from '../support/api';
import { db, resetCatalog, truncateAll } from '../support/db';
import { makeStaff, publicBooking } from '../support/fixtures';

let manager: SessionUser;
let operator: SessionUser;
let editor: SessionUser;
beforeAll(async () => {
  useFakeIntegrationEnv();
  await resetCatalog();
});
beforeEach(async () => {
  await truncateAll();
  manager = await makeStaff('MANAGER');
  operator = await makeStaff('OPERATOR');
  editor = await makeStaff('EDITOR');
});

describe('production pipeline', () => {
  it('11. confirming a booking creates the task set of its tariff', async () => {
    const b = await publicBooking({ service: 'premium', duration: 90 });
    await changeBookingStatus(db, manager, { bookingId: b.id, status: 'CONFIRMED' });
    const tasks = await db.productionTask.findMany({ where: { bookingId: b.id } });
    expect(tasks.map((t) => t.templateKey).sort()).toEqual(DEFAULT_PRODUCTION_TEMPLATES.premium.map((t) => t.key).sort());
    expect(tasks.every((t) => t.dueAt)).toBe(true);
  });

  it('12. never duplicates the task set (re-confirmation, parallel calls)', async () => {
    const b = await publicBooking({ service: 'pro', duration: 90 });
    await changeBookingStatus(db, manager, { bookingId: b.id, status: 'CONFIRMED' });
    await changeBookingStatus(db, manager, { bookingId: b.id, status: 'PENDING_PAYMENT' });
    await changeBookingStatus(db, manager, { bookingId: b.id, status: 'CONFIRMED' });
    await Promise.all([1, 2, 3].map(() => db.$transaction((tx) => createTasksForBooking(tx, b.id, null))));
    expect(await db.productionTask.count({ where: { bookingId: b.id } })).toBe(DEFAULT_PRODUCTION_TEMPLATES.pro.length);
  });

  it('13. OPERATOR/EDITOR edit only their own tasks of their stage; only managers assign', async () => {
    const b = await publicBooking({ service: 'pro', duration: 90 });
    await changeBookingStatus(db, manager, { bookingId: b.id, status: 'CONFIRMED' });
    const rec = await db.productionTask.findFirstOrThrow({ where: { bookingId: b.id, type: 'RECORDING' } });
    const edit = await db.productionTask.findFirstOrThrow({ where: { bookingId: b.id, type: 'EDITING' } });

    await expect(updateTask(db, operator, { taskId: rec.id, status: 'IN_PROGRESS' })).rejects.toThrow(RuleError); // not assigned yet
    await expect(updateTask(db, operator, { taskId: rec.id, assignedToId: operator.id })).rejects.toThrow(RuleError); // cannot self-assign
    await updateTask(db, manager, { taskId: rec.id, assignedToId: operator.id });
    await updateTask(db, manager, { taskId: edit.id, assignedToId: editor.id });

    await updateTask(db, operator, { taskId: rec.id, status: 'DONE', checklist: [{ text: 'Звук записан', done: true }] });
    expect(await db.productionTask.findUniqueOrThrow({ where: { id: rec.id } })).toMatchObject({ status: 'DONE' });
    await expect(updateTask(db, operator, { taskId: edit.id, status: 'IN_PROGRESS' })).rejects.toThrow(RuleError);
    await expect(updateTask(db, editor, { taskId: rec.id, status: 'TODO' })).rejects.toThrow(RuleError);
    await updateTask(db, editor, { taskId: edit.id, status: 'IN_PROGRESS', materialsUrl: 'https://drive.google.com/x' });
    await expect(updateTask(db, editor, { taskId: edit.id, priority: 'URGENT' })).rejects.toThrow(/менеджер/);
    await addTaskComment(db, editor, { taskId: edit.id, body: 'Нужен второй дубль' });
    await expect(addTaskComment(db, operator, { taskId: edit.id, body: 'x' })).rejects.toThrow(RuleError);
    await expect(createTask(db, operator, { bookingId: b.id, type: 'REVIEW', title: 'Новая' })).rejects.toThrow(RuleError);
    expect(await db.activityLog.count({ where: { action: 'task.update' } })).toBeGreaterThanOrEqual(4);
  });

  it('completing delivery with materials sends "order ready" once', async () => {
    const b = await publicBooking({ service: 'starter', duration: 60 });
    await changeBookingStatus(db, manager, { bookingId: b.id, status: 'CONFIRMED' });
    const delivery = await db.productionTask.findFirstOrThrow({ where: { bookingId: b.id, type: 'DELIVERY' } });
    await updateTask(db, manager, { taskId: delivery.id, status: 'DONE', materialsUrl: 'https://drive.google.com/done' });
    await updateTask(db, manager, { taskId: delivery.id, status: 'IN_PROGRESS' });
    await updateTask(db, manager, { taskId: delivery.id, status: 'DONE' });
    expect(await db.integrationJob.count({ where: { entityId: b.id, type: 'booking.ready_email' } })).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).materialsUrl).toBe('https://drive.google.com/done');
  });

  it('rescheduling shifts open task deadlines with the session', async () => {
    const b = await publicBooking({ service: 'pro', duration: 90, time: '12:00' });
    await changeBookingStatus(db, manager, { bookingId: b.id, status: 'CONFIRMED' });
    const before = await db.productionTask.findFirstOrThrow({ where: { bookingId: b.id, type: 'EDITING' } });
    await rescheduleBooking(db, manager, { bookingId: b.id, date: futureDay(), time: '15:00' });
    const after = await db.productionTask.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.dueAt!.getTime() - before.dueAt!.getTime()).toBe(3 * 3600_000);
  });
});
