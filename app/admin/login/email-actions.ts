'use server';

import { redirect } from 'next/navigation';
import { EMAIL_LINK_TTL_MINUTES, consumeEmailLogin, requestEmailLogin } from '@/lib/auth/email-login';
import { LOGIN_PATH } from '@/lib/auth/constants';
import { safeAdminRedirect } from '@/lib/auth/redirect';
import { getClientIp, getUserAgent, setSessionCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { getAuthSecret, getSiteUrl } from '@/lib/env';
import { getIntegrationConfig, isDryRun } from '@/lib/integrations/config';
import { log } from '@/lib/log';
import { loginLinkEmail } from '@/lib/notifications/templates';
import { getTransports } from '@/lib/outbox/transports';

export interface EmailLinkState {
  sent?: boolean;
  email?: string;
  error?: string;
}

/** Step 1: send a one-time sign-in link. The same answer for known and unknown emails. */
export async function requestEmailLinkAction(_prev: EmailLinkState, formData: FormData): Promise<EmailLinkState> {
  // Checked before touching the account, so the answer does not depend on who asks.
  if (!getIntegrationConfig().email && !isDryRun()) {
    return { error: 'Вход по почте пока недоступен: не настроена отправка писем. Войдите по паролю.' };
  }
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const next = safeAdminRedirect(formData.get('next'));
  let result;
  try {
    result = await requestEmailLogin(prisma, { secret: getAuthSecret(), email, clientIp: await getClientIp() });
  } catch (error) {
    log.error('auth.email_link.request_failed', { error });
    return { error: 'Сервис временно недоступен. Попробуйте позже.' };
  }
  if (result.status === 'invalid_email') return { error: 'Введите корректный email' };
  if (result.status === 'rate_limited') {
    return { error: `Слишком много запросов. Повторите через ${Math.max(1, Math.ceil(result.retryAfterSeconds / 60))} мин.` };
  }
  if (result.status === 'sent') {
    const url = new URL(`${LOGIN_PATH}/verify`, getSiteUrl());
    url.searchParams.set('token', result.token);
    if (next !== '/admin') url.searchParams.set('next', next);
    try {
      await getTransports().sendEmail({ to: result.user.email, ...loginLinkEmail({ name: result.user.name, url: url.toString(), ttlMinutes: EMAIL_LINK_TTL_MINUTES }) });
      // Local development in dry-run mode: the link is printed to the server console instead of being emailed.
      if (isDryRun() && process.env.NODE_ENV === 'development') log.info('auth.email_link.dev', { link: url.toString() });
    } catch (error) {
      log.error('auth.email_link.send_failed', { error });
    }
  }
  return { sent: true, email };
}

export interface ConsumeState {
  error?: string;
}

/** Step 2: the button on the page the link opens. A POST, so mail scanners that open links cannot use them up. */
export async function consumeEmailLinkAction(_prev: ConsumeState, formData: FormData): Promise<ConsumeState> {
  let result;
  try {
    result = await consumeEmailLogin(prisma, { token: formData.get('token'), userAgent: await getUserAgent() });
  } catch (error) {
    log.error('auth.email_link.consume_failed', { error });
    return { error: 'Сервис временно недоступен. Попробуйте позже.' };
  }
  if (!result.ok) return { error: 'Ссылка устарела или уже использована. Запросите новую.' };
  await setSessionCookie(result.token);
  redirect(safeAdminRedirect(formData.get('next')));
}
