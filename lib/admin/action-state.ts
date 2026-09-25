import { ZodError } from 'zod';
import { AuthorizationError } from '@/lib/auth/session';
import { RuleError } from './errors';
import { log } from '@/lib/log';

export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
}

/** Converts an unexpected error in a Server Action into a safe message (no internals leak to the client). */
export function actionError(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { error: error.message };
  if (error instanceof RuleError) return { error: error.message };
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? 'Проверьте введённые данные' };
  log.error('admin.action_failed', { error });
  return { error: 'Не удалось сохранить изменения. Попробуйте ещё раз.' };
}
