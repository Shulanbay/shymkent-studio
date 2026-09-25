import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import type { SessionUser } from '@/lib/auth/service';
import { isUniqueViolation } from '@/lib/bookings/shared';
import { RuleError } from './errors';

// Rooms and tariffs. Rules: a room/tariff that has bookings is never deleted
// (archive instead) and its slug is frozen, because bookings, links and
// reports refer to it.

const slug = z.string().trim().regex(/^[a-z0-9-]{2,32}$/, 'Slug: 2–32 символа, латиница, цифры и дефис');
const int = (min: number, max: number, label: string) =>
  z.coerce.number({ message: `${label}: укажите число` }).int(`${label}: целое число`).min(min, `${label}: не меньше ${min}`).max(max, `${label}: не больше ${max}`);

export const roomSchema = z.object({
  slug,
  nameRu: z.string().trim().min(2).max(80),
  nameKk: z.string().trim().min(2).max(80),
  capacity: int(1, 20, 'Вместимость'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в формате #RRGGBB'),
  googleColorId: z
    .string()
    .regex(/^(?:[1-9]|1[01])?$/, 'Цвет Google: 1–11')
    .transform((v) => v || null),
  bufferBeforeMinutes: int(0, 120, 'Буфер до'),
  bufferAfterMinutes: int(0, 120, 'Буфер после'),
  sortOrder: int(0, 1000, 'Порядок'),
});

export const serviceSchema = z
  .object({
    slug,
    nameRu: z.string().trim().min(2).max(120),
    nameKk: z.string().trim().min(2).max(120),
    descriptionRu: z.string().trim().max(500),
    descriptionKk: z.string().trim().max(500),
    basePrice: int(0, 10_000_000, 'Цена'),
    defaultDuration: int(15, 600, 'Длительность'),
    maxDuration: int(15, 600, 'Максимальная длительность'),
    extraStepMinutes: z
      .union([z.literal(''), int(5, 240, 'Шаг продления')])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    extraStepPrice: z
      .union([z.literal(''), int(0, 10_000_000, 'Цена шага')])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    sortOrder: int(0, 1000, 'Порядок'),
  })
  .superRefine((s, ctx) => {
    if (s.maxDuration < s.defaultDuration) ctx.addIssue({ code: 'custom', path: ['maxDuration'], message: 'Максимальная длительность меньше базовой' });
    if ((s.extraStepMinutes === null) !== (s.extraStepPrice === null)) {
      ctx.addIssue({ code: 'custom', path: ['extraStepMinutes'], message: 'Шаг продления и его цену нужно указать вместе' });
    }
    if (s.extraStepMinutes === null && s.maxDuration !== s.defaultDuration) {
      ctx.addIssue({ code: 'custom', path: ['maxDuration'], message: 'Без шага продления длительность фиксирована' });
    }
    if (s.extraStepMinutes !== null && (s.maxDuration - s.defaultDuration) % s.extraStepMinutes !== 0) {
      ctx.addIssue({ code: 'custom', path: ['maxDuration'], message: 'Максимальная длительность должна складываться из шагов продления' });
    }
  });

type Kind = 'room' | 'service';

async function usage(db: PrismaClient, kind: Kind, id: string) {
  return kind === 'room' ? db.booking.count({ where: { roomId: id } }) : db.booking.count({ where: { serviceId: id } });
}

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.keys(after).filter((k) => before[k] !== after[k]);
}

export async function saveRoom(db: PrismaClient, actor: SessionUser, input: { id?: string } & Record<string, unknown>) {
  const data = roomSchema.parse(input);
  try {
    if (!input.id) {
      const room = await db.room.create({ data });
      await logActivity(db, { userId: actor.id, entityType: 'Room', entityId: room.id, action: 'catalog.room', metadata: { op: 'create', slug: room.slug } });
      return room;
    }
    const current = await db.room.findUnique({ where: { id: input.id } });
    if (!current) throw new RuleError('Комната не найдена');
    if (current.slug !== data.slug && (await usage(db, 'room', current.id)) > 0) {
      throw new RuleError('Slug комнаты с заказами менять нельзя (на него ссылаются заказы и ссылки сайта)');
    }
    const fields = changedFields(current, data);
    if (fields.length === 0) return current;
    const room = await db.room.update({ where: { id: current.id }, data });
    await logActivity(db, { userId: actor.id, entityType: 'Room', entityId: room.id, action: 'catalog.room', metadata: { op: 'update', fields } });
    return room;
  } catch (error) {
    if (isUniqueViolation(error, 'slug')) throw new RuleError('Такой slug уже используется');
    throw error;
  }
}

export async function saveService(db: PrismaClient, actor: SessionUser, input: { id?: string } & Record<string, unknown>) {
  const data = serviceSchema.parse(input);
  try {
    if (!input.id) {
      const service = await db.service.create({ data });
      await logActivity(db, { userId: actor.id, entityType: 'Service', entityId: service.id, action: 'catalog.service', metadata: { op: 'create', slug: service.slug } });
      return service;
    }
    const current = await db.service.findUnique({ where: { id: input.id } });
    if (!current) throw new RuleError('Тариф не найден');
    if (current.slug !== data.slug && (await usage(db, 'service', current.id)) > 0) {
      throw new RuleError('Slug тарифа с заказами менять нельзя');
    }
    const fields = changedFields(current, data);
    if (fields.length === 0) return current;
    const service = await db.service.update({ where: { id: current.id }, data });
    // Prices are logged (they matter for audits); existing bookings keep their stored amounts.
    await logActivity(db, {
      userId: actor.id,
      entityType: 'Service',
      entityId: service.id,
      action: 'catalog.service',
      metadata: { op: 'update', fields, ...(fields.includes('basePrice') ? { basePrice: { from: current.basePrice, to: service.basePrice } } : {}) },
    });
    return service;
  } catch (error) {
    if (isUniqueViolation(error, 'slug')) throw new RuleError('Такой slug уже используется');
    throw error;
  }
}

/** Archive = hide from the public site and the booking form; history stays intact. */
export async function setArchived(db: PrismaClient, actor: SessionUser, kind: Kind, id: string, archived: boolean) {
  const entity = kind === 'room' ? await db.room.findUnique({ where: { id } }) : await db.service.findUnique({ where: { id } });
  if (!entity) throw new RuleError('Не найдено');
  if (entity.active === !archived) return entity;
  if (archived) {
    const activeCount = kind === 'room' ? await db.room.count({ where: { active: true } }) : await db.service.count({ where: { active: true } });
    if (activeCount <= 1) throw new RuleError('Нельзя архивировать последнюю активную запись — онлайн-запись перестанет работать');
  }
  const updated =
    kind === 'room'
      ? await db.room.update({ where: { id }, data: { active: !archived } })
      : await db.service.update({ where: { id }, data: { active: !archived } });
  await logActivity(db, {
    userId: actor.id,
    entityType: kind === 'room' ? 'Room' : 'Service',
    entityId: id,
    action: kind === 'room' ? 'catalog.room' : 'catalog.service',
    metadata: { op: archived ? 'archive' : 'restore' },
  });
  return updated;
}

/** Deletes only entities that were never used; otherwise asks to archive. */
export async function deleteCatalogEntity(db: PrismaClient, actor: SessionUser, kind: Kind, id: string) {
  const used = await usage(db, kind, id);
  if (used > 0) throw new RuleError(`Используется в ${used} заказах — удалить нельзя, можно только архивировать`);
  const entity = kind === 'room' ? await db.room.findUnique({ where: { id } }) : await db.service.findUnique({ where: { id } });
  if (!entity) throw new RuleError('Не найдено');
  if (kind === 'room') await db.room.delete({ where: { id } });
  else await db.service.delete({ where: { id } });
  await logActivity(db, {
    userId: actor.id,
    entityType: kind === 'room' ? 'Room' : 'Service',
    entityId: id,
    action: kind === 'room' ? 'catalog.room' : 'catalog.service',
    metadata: { op: 'delete', slug: entity.slug },
  });
}
