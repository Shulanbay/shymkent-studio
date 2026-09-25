import 'server-only';
import type { Prisma, PrismaClient, ProductionTaskStatus, ProductionTaskType } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import { canWorkOnTask, hasPermission } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/service';
import { getEffectiveIntegrationConfig } from '@/lib/integrations/effective';
import { bookingReadyJobs, enqueueJobs } from '@/lib/outbox/jobs';
import { getProductionTemplates } from '@/lib/settings';
import { PRODUCTION_TYPES, type TaskTemplate } from '@/lib/settings-schema';
import { addDays, studioDayRange, todayInStudio } from '@/lib/time';
import { RuleError } from './errors';
import { optionalStudioDateTime } from './zod-helpers';

type Tx = Prisma.TransactionClient;

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
/** Tasks of these bookings are frozen: they leave the pipeline, overdue counters and cannot be changed. */
export const INACTIVE_BOOKING_STATUSES = ['CANCELLED', 'NO_SHOW'] as const;
const INACTIVE_MESSAGE = 'Заказ отменён или клиент не пришёл — задачи по нему больше не ведутся';
export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((i): i is { text: unknown; done: unknown } => Boolean(i) && typeof i === 'object')
    .map((i) => ({ text: String(i.text ?? '').slice(0, 200), done: Boolean(i.done) }))
    .filter((i) => i.text);
}

export function isInactiveBooking(status: string): boolean {
  return (INACTIVE_BOOKING_STATUSES as readonly string[]).includes(status);
}

/** Pure: due date of a template item for a booking. */
export function templateDueAt(t: TaskTemplate, booking: { startAt: Date; endAt: Date }): Date {
  const base = t.relativeToStart ? booking.startAt : booking.endAt;
  return new Date(base.getTime() + t.dueOffsetHours * 3600_000);
}

/**
 * Creates the task set of the booking's tariff. Idempotent: (bookingId, templateKey)
 * is unique, so confirming twice (or concurrently) never duplicates tasks.
 */
export async function createTasksForBooking(tx: Tx, bookingId: string, actorId: string | null): Promise<number> {
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { service: true } });
  const templates = (await getProductionTemplates(tx))[booking.service.slug] ?? [];
  if (templates.length === 0) return 0;
  const { count } = await tx.productionTask.createMany({
    data: templates.map((t) => ({
      bookingId,
      templateKey: t.key,
      type: t.type,
      title: t.title,
      priority: t.priority,
      dueAt: templateDueAt(t, booking),
      checklist: t.checklist.map((text) => ({ text, done: false })),
    })),
    skipDuplicates: true,
  });
  if (count > 0) {
    await logActivity(tx, {
      userId: actorId,
      entityType: 'Booking',
      entityId: bookingId,
      action: 'task.generate',
      metadata: { created: count, tariff: booking.service.slug },
    });
  }
  return count;
}

/** After a reschedule, open tasks keep their offset relative to the session. */
export async function shiftOpenTaskDeadlines(tx: Tx, bookingId: string, deltaMs: number) {
  if (deltaMs === 0) return;
  await tx.$executeRaw`
    UPDATE "ProductionTask" SET "dueAt" = "dueAt" + make_interval(secs => ${deltaMs / 1000}::double precision), "updatedAt" = now()
    WHERE "bookingId" = ${bookingId} AND "status" <> 'DONE' AND "dueAt" IS NOT NULL`;
}

// ─── Listing ──────────────────────────────────────────────────────────────────

export const taskFiltersSchema = z.object({
  view: z.enum(['kanban', 'list']).catch('kanban'),
  assignee: z.string().max(40).optional().catch(undefined),
  type: z.enum(PRODUCTION_TYPES).optional().catch(undefined),
  status: z.enum(TASK_STATUSES).optional().catch(undefined),
  due: z.enum(['overdue', 'today', 'week']).optional().catch(undefined),
  booking: z.string().max(40).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type TaskFilters = z.infer<typeof taskFiltersSchema>;
export const TASKS_PAGE_SIZE = 50;

export function taskWhere(f: TaskFilters, me: SessionUser, now = new Date()): Prisma.ProductionTaskWhereInput {
  const and: Prisma.ProductionTaskWhereInput[] = [];
  if (f.assignee === 'me') and.push({ assignedToId: me.id });
  else if (f.assignee === 'none') and.push({ assignedToId: null });
  else if (f.assignee) and.push({ assignedToId: f.assignee });
  if (f.type) and.push({ type: f.type });
  if (f.status) and.push({ status: f.status });
  if (f.booking) and.push({ bookingId: f.booking });
  if (f.due === 'overdue') and.push({ status: { not: 'DONE' }, dueAt: { lt: now } });
  if (f.due === 'today') and.push({ dueAt: { gte: studioDayRange(todayInStudio(now)).start, lt: studioDayRange(todayInStudio(now)).end } });
  if (f.due === 'week') and.push({ dueAt: { gte: now, lt: studioDayRange(addDays(todayInStudio(now), 7)).end } });
  // Cancelled / no-show bookings drop out of the pipeline.
  and.push({ booking: { status: { notIn: [...INACTIVE_BOOKING_STATUSES] } } });
  return { AND: and };
}

export async function listTasks(db: PrismaClient, f: TaskFilters, me: SessionUser) {
  const where = taskWhere(f, me);
  const [items, total] = await Promise.all([
    db.productionTask.findMany({
      where,
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      skip: f.view === 'list' ? (f.page - 1) * TASKS_PAGE_SIZE : 0,
      take: f.view === 'list' ? TASKS_PAGE_SIZE : 400,
      include: {
        assignedTo: { select: { id: true, name: true } },
        booking: { select: { id: true, bookingNumber: true, startAt: true, paymentStatus: true, client: { select: { name: true } }, service: { select: { nameRu: true } } } },
        _count: { select: { comments: true } },
      },
    }),
    db.productionTask.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / TASKS_PAGE_SIZE)) };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

const optionalUrl = z
  .union([z.literal(''), z.url({ protocol: /^https?$/, message: 'Ссылка должна начинаться с http:// или https://' }).max(1000)])
  .optional();

const createSchema = z.object({
  bookingId: z.string().min(1),
  type: z.enum(PRODUCTION_TYPES),
  title: z.string().trim().min(2, 'Название слишком короткое').max(120),
  dueAt: optionalStudioDateTime,
  priority: z.enum(TASK_PRIORITIES).default('NORMAL'),
  assignedToId: z.string().max(40).optional(),
});

async function assertAssignee(tx: Tx, userId: string | null | undefined) {
  if (!userId) return null;
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user?.active) throw new RuleError('Исполнитель не найден или отключён');
  return user.id;
}

export async function createTask(db: PrismaClient, actor: SessionUser, input: z.input<typeof createSchema>) {
  if (!hasPermission(actor.role, 'production:manage')) throw new RuleError('Создавать задачи может менеджер или администратор');
  const data = createSchema.parse(input);
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: data.bookingId } });
    if (!booking) throw new RuleError('Заказ не найден');
    if (isInactiveBooking(booking.status)) throw new RuleError(INACTIVE_MESSAGE);
    const task = await tx.productionTask.create({
      data: {
        bookingId: booking.id,
        type: data.type as ProductionTaskType,
        title: data.title,
        dueAt: data.dueAt ?? null,
        priority: data.priority,
        assignedToId: await assertAssignee(tx, data.assignedToId || null),
      },
    });
    await logActivity(tx, { userId: actor.id, entityType: 'ProductionTask', entityId: task.id, action: 'task.create', metadata: { bookingId: booking.id, type: task.type } });
    return task;
  });
}

const updateSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(TASK_STATUSES).optional(),
  checklist: z.array(z.object({ text: z.string().trim().min(1).max(200), done: z.boolean() })).max(30).optional(),
  materialsUrl: optionalUrl,
  notes: z.string().max(5000).optional(),
  // Management fields:
  title: z.string().trim().min(2).max(120).optional(),
  assignedToId: z.string().max(40).nullable().optional(),
  dueAt: z.union([z.null(), optionalStudioDateTime]).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
});

const MANAGE_FIELDS = ['title', 'assignedToId', 'dueAt', 'priority'] as const;

/**
 * Updates a task. Progress fields need canWorkOnTask (own task of the right type
 * for OPERATOR/EDITOR); assignment, deadline, priority and title need production:manage.
 */
export async function updateTask(db: PrismaClient, actor: SessionUser, input: z.input<typeof updateSchema>) {
  const data = updateSchema.parse(input);
  return db.$transaction(async (tx) => {
    const task = await tx.productionTask.findUnique({ where: { id: data.taskId }, include: { booking: { include: { client: true } } } });
    if (!task) throw new RuleError('Задача не найдена');
    if (!canWorkOnTask(actor, task)) throw new RuleError('Эта задача вам недоступна: можно менять только свои задачи своего этапа');
    if (isInactiveBooking(task.booking.status)) throw new RuleError(INACTIVE_MESSAGE);
    const touchesManage = MANAGE_FIELDS.some((k) => data[k] !== undefined);
    if (touchesManage && !hasPermission(actor.role, 'production:manage')) {
      throw new RuleError('Назначать исполнителя, срок и приоритет может менеджер или администратор');
    }

    const next: Prisma.ProductionTaskUpdateInput = {};
    const changed: string[] = [];
    if (data.status && data.status !== task.status) {
      next.status = data.status as ProductionTaskStatus;
      next.completedAt = data.status === 'DONE' ? new Date() : null;
      changed.push('status');
    }
    if (data.checklist) (next.checklist = data.checklist), changed.push('checklist');
    if (data.materialsUrl !== undefined && (data.materialsUrl || null) !== task.materialsUrl) {
      next.materialsUrl = data.materialsUrl || null;
      changed.push('materialsUrl');
    }
    if (data.notes !== undefined && (data.notes.trim() || null) !== task.notes) (next.notes = data.notes.trim() || null), changed.push('notes');
    if (data.title && data.title !== task.title) (next.title = data.title), changed.push('title');
    if (data.priority && data.priority !== task.priority) (next.priority = data.priority), changed.push('priority');
    if (data.dueAt !== undefined && (data.dueAt?.getTime() ?? null) !== (task.dueAt?.getTime() ?? null)) (next.dueAt = data.dueAt), changed.push('dueAt');
    if (data.assignedToId !== undefined && (data.assignedToId || null) !== task.assignedToId) {
      next.assignedTo = data.assignedToId ? { connect: { id: (await assertAssignee(tx, data.assignedToId))! } } : { disconnect: true };
      changed.push('assignedToId');
    }
    if (changed.length === 0) return { jobIds: [] as string[] };

    await tx.productionTask.update({ where: { id: task.id }, data: next });
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'ProductionTask',
      entityId: task.id,
      action: 'task.update',
      metadata: {
        fields: changed,
        bookingId: task.bookingId,
        ...(next.status ? { from: task.status, to: data.status! } : {}),
        ...(changed.includes('assignedToId') ? { assignedToId: data.assignedToId ?? null } : {}),
      },
    });

    // Delivery done → materials go to the booking and the client gets "your order is ready" (once).
    let jobIds: string[] = [];
    if (data.status === 'DONE' && task.type === 'DELIVERY') {
      const materials = (data.materialsUrl || task.materialsUrl || task.booking.materialsUrl) ?? null;
      if (materials && !task.booking.materialsUrl) await tx.booking.update({ where: { id: task.bookingId }, data: { materialsUrl: materials } });
      if (materials) {
        const config = await getEffectiveIntegrationConfig(tx);
        jobIds = await enqueueJobs(tx, bookingReadyJobs(task.bookingId, { config, hasClientEmail: Boolean(task.booking.client.email) }));
      }
    }
    return { jobIds };
  });
}

export async function addTaskComment(db: PrismaClient, actor: SessionUser, input: { taskId: string; body: string }) {
  const body = z.string().trim().min(1, 'Пустой комментарий').max(2000).parse(input.body);
  return db.$transaction(async (tx) => {
    const task = await tx.productionTask.findUnique({ where: { id: input.taskId }, include: { booking: { select: { status: true } } } });
    if (!task) throw new RuleError('Задача не найдена');
    if (!canWorkOnTask(actor, task)) throw new RuleError('Комментировать можно только доступные вам задачи');
    if (isInactiveBooking(task.booking.status)) throw new RuleError(INACTIVE_MESSAGE);
    const comment = await tx.taskComment.create({ data: { taskId: task.id, userId: actor.id, body } });
    await logActivity(tx, { userId: actor.id, entityType: 'ProductionTask', entityId: task.id, action: 'task.comment' });
    return comment;
  });
}
