'use server';

import { redirect } from 'next/navigation';
import { safeAdminRedirect } from '@/lib/auth/redirect';
import { authenticate } from '@/lib/auth/service';
import { getClientIp, getUserAgent, setSessionCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { getAuthSecret } from '@/lib/env';
import { log } from '@/lib/log';

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  let result;
  try {
    result = await authenticate(prisma, {
      secret: getAuthSecret(),
      email: formData.get('email'),
      password: formData.get('password'),
      clientIp: await getClientIp(),
      userAgent: await getUserAgent(),
    });
  } catch {
    log.error('auth.login.server_error');
    return { error: 'Сервис временно недоступен. Попробуйте позже.' };
  }

  if (!result.ok) {
    if (result.error === 'RATE_LIMITED') {
      const minutes = Math.max(1, Math.ceil((result.retryAfterSeconds ?? 60) / 60));
      return { error: `Слишком много попыток входа. Повторите через ${minutes} мин.` };
    }
    return { error: 'Неверный email или пароль' };
  }

  await setSessionCookie(result.token);
  redirect(safeAdminRedirect(formData.get('next')));
}
