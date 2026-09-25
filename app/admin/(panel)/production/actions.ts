'use server';

import { revalidatePath } from 'next/cache';
import { actionError, type ActionState } from '@/lib/admin/action-state';
import { addTaskComment, createTask, parseChecklist, updateTask } from '@/lib/admin/production';
import { AuthorizationError, getCurrentUser } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db';
import { scheduleOutboxProcessing } from '@/lib/outbox/schedule';

const str = (f: FormData, k: string) => String(f.get(k) ?? '');

/** Anyone with production access; fine-grained rules (own task / own stage) are enforced in lib/admin/production. */
async function productionUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError(401);
  if (!hasPermission(user.role, 'production:view')) throw new AuthorizationError(403);
  return user;
}

function refresh(taskId?: string, bookingId?: string) {
  revalidatePath('/admin/production');
  if (taskId) revalidatePath(`/admin/production/${taskId}`);
  if (bookingId) revalidatePath(`/admin/bookings/${bookingId}`);
}

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await productionUser();
    const bookingId = str(formData, 'bookingId');
    await createTask(prisma, actor, {
      bookingId,
      type: str(formData, 'type') as never,
      title: str(formData, 'title'),
      dueAt: str(formData, 'dueAt') || undefined,
      assignedToId: str(formData, 'assignedToId'),
    });
    refresh(undefined, bookingId);
    return { ok: true, message: 'Задача добавлена' };
  } catch (error) {
    return actionError(error);
  }
}

/** Kanban drag-and-drop / quick status change. */
export async function moveTaskAction(input: { taskId: string; status: string }): Promise<ActionState> {
  try {
    const actor = await productionUser();
    const result = await updateTask(prisma, actor, { taskId: input.taskId, status: input.status as never });
    scheduleOutboxProcessing(result.jobIds);
    refresh(input.taskId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await productionUser();
    const taskId = str(formData, 'taskId');
    const task = await prisma.productionTask.findUnique({ where: { id: taskId } });
    if (!task) return { error: 'Задача не найдена' };
    // Checklist: existing items with their "done" boxes plus an optional new item.
    const items = parseChecklist(task.checklist).map((item, i) => ({ text: item.text, done: formData.get(`check-${i}`) === 'on' }));
    const added = str(formData, 'newItem').trim();
    if (added) items.push({ text: added, done: false });
    const manage = hasPermission(actor.role, 'production:manage');
    const result = await updateTask(prisma, actor, {
      taskId,
      status: (str(formData, 'status') || undefined) as never,
      checklist: formData.has('checklistPresent') ? items : undefined,
      materialsUrl: formData.has('materialsUrl') ? str(formData, 'materialsUrl') : undefined,
      notes: formData.has('notes') ? str(formData, 'notes') : undefined,
      ...(manage
        ? {
            title: str(formData, 'title') || undefined,
            priority: (str(formData, 'priority') || undefined) as never,
            assignedToId: formData.has('assignedToId') ? str(formData, 'assignedToId') || null : undefined,
            dueAt: formData.has('dueAt') ? str(formData, 'dueAt') || null : undefined,
          }
        : {}),
    });
    scheduleOutboxProcessing(result.jobIds);
    refresh(taskId, task.bookingId);
    return { ok: true, message: 'Сохранено' };
  } catch (error) {
    return actionError(error);
  }
}

export async function commentTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await productionUser();
    const taskId = str(formData, 'taskId');
    await addTaskComment(prisma, actor, { taskId, body: str(formData, 'body') });
    refresh(taskId);
    return { ok: true, message: 'Комментарий добавлен' };
  } catch (error) {
    return actionError(error);
  }
}
