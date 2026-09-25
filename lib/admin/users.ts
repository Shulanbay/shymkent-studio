import 'server-only';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { ROLES, type Role } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/service';
import { RuleError } from './errors';

// Staff management rules. Callers must already have checked `users:manage`;
// these functions enforce the invariants that must hold regardless of UI.

export class UserRuleError extends RuleError {}

const passwordSchema = z.string().superRefine((value, ctx) => {
  const problem = validatePasswordStrength(value);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя').max(100),
  email: z.string().trim().toLowerCase().pipe(z.email('Некорректный email')).pipe(z.string().max(254)),
  role: z.enum(ROLES),
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
  active: z.boolean(),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: passwordSchema,
});

export async function createStaffUser(db: PrismaClient, actor: SessionUser, input: unknown) {
  const data = createUserSchema.parse(input);
  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: data.name, email: data.email, role: data.role, passwordHash: await hashPassword(data.password) },
      });
      await logActivity(tx, {
        userId: actor.id,
        entityType: 'User',
        entityId: user.id,
        action: 'user.create',
        metadata: { role: data.role },
      });
      return user;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new UserRuleError('Сотрудник с таким email уже существует');
    }
    throw error;
  }
}

async function countOtherActiveOwners(tx: Prisma.TransactionClient, excludeUserId: string) {
  return tx.user.count({ where: { role: 'OWNER', active: true, id: { not: excludeUserId } } });
}

export async function updateStaffUser(db: PrismaClient, actor: SessionUser, input: unknown) {
  const data = updateUserSchema.parse(input);
  return db.$transaction(
    async (tx) => {
      const target = await tx.user.findUnique({ where: { id: data.userId } });
      if (!target) throw new UserRuleError('Сотрудник не найден');

      if (target.id === actor.id && (data.role !== target.role || !data.active)) {
        throw new UserRuleError('Нельзя изменить собственную роль или отключить собственный доступ');
      }
      const losesOwner = target.role === 'OWNER' && target.active && (data.role !== 'OWNER' || !data.active);
      if (losesOwner && (await countOtherActiveOwners(tx, target.id)) === 0) {
        throw new UserRuleError('В системе должен остаться хотя бы один активный владелец');
      }

      const changes: Record<string, { from: Role | boolean; to: Role | boolean }> = {};
      if (target.role !== data.role) changes.role = { from: target.role, to: data.role };
      if (target.active !== data.active) changes.active = { from: target.active, to: data.active };
      if (Object.keys(changes).length === 0) return target;

      const user = await tx.user.update({ where: { id: target.id }, data: { role: data.role, active: data.active } });
      // A deactivated employee is signed out everywhere immediately.
      if (!data.active) await tx.session.deleteMany({ where: { userId: target.id } });
      await logActivity(tx, {
        userId: actor.id,
        entityType: 'User',
        entityId: target.id,
        action: 'user.update',
        metadata: changes,
      });
      return user;
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function resetStaffPassword(db: PrismaClient, actor: SessionUser, input: unknown) {
  const data = resetPasswordSchema.parse(input);
  const passwordHash = await hashPassword(data.password);
  await db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: data.userId } });
    if (!target) throw new UserRuleError('Сотрудник не найден');
    await tx.user.update({ where: { id: target.id }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: target.id } });
    await logActivity(tx, { userId: actor.id, entityType: 'User', entityId: target.id, action: 'user.password_reset' });
  });
}
