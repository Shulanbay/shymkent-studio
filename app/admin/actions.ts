'use server';

import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { LOGIN_PATH } from '@/lib/auth/constants';
import { revokeSessionToken } from '@/lib/auth/service';
import { clearSessionCookie, readSessionToken } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export async function logoutAction() {
  const token = await readSessionToken();
  if (token) {
    const userId = await revokeSessionToken(prisma, token);
    if (userId) {
      await logActivity(prisma, { userId, entityType: 'Auth', entityId: userId, action: 'auth.logout' });
    }
  }
  await clearSessionCookie();
  redirect(LOGIN_PATH);
}
