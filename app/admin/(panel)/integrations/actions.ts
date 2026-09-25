'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { actionError, type ActionState } from '@/lib/admin/action-state';
import { RuleError } from '@/lib/admin/errors';
import { assertPermission } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { processOutbox, requeueJob } from '@/lib/outbox/process';

export async function retryJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let outcome: 'ok' | 'failed';
  try {
    const actor = await assertPermission('integrations:view');
    const jobId = String(formData.get('jobId') ?? '');
    if (!(await requeueJob(prisma, jobId))) throw new RuleError('Задачу нельзя повторить (уже выполнена или выполняется)');
    await logActivity(prisma, { userId: actor.id, entityType: 'IntegrationJob', entityId: jobId, action: 'integration.retry' });
    const result = await processOutbox(prisma, { ids: [jobId] });
    outcome = result.completed ? 'ok' : 'failed';
  } catch (error) {
    return actionError(error);
  }
  revalidatePath('/admin/integrations');
  // The row may leave the current filter, so the result is shown as a page banner.
  redirect(`/admin/integrations?retried=${outcome}`);
}

export async function processQueueAction(_prev: ActionState): Promise<ActionState> {
  try {
    const actor = await assertPermission('integrations:view');
    const result = await processOutbox(prisma, { limit: 50 });
    await logActivity(prisma, { userId: actor.id, entityType: 'IntegrationJob', action: 'integration.process', metadata: { ...result } });
    revalidatePath('/admin/integrations');
    return { ok: true, message: `Обработано: ${result.claimed}, успешно: ${result.completed}, повтор позже: ${result.retrying}, ошибок: ${result.failed}` };
  } catch (error) {
    return actionError(error);
  }
}
