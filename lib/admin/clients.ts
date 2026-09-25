import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import type { SessionUser } from '@/lib/auth/service';
import { maskPhone } from '@/lib/phone';
import { RuleError } from './errors';

export const clientFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type ClientFilters = z.infer<typeof clientFiltersSchema>;
export const CLIENTS_PAGE_SIZE = 25;

/** Sum of non-cancelled booking amounts per client. */
async function totalsFor(db: PrismaClient, clientIds: string[]) {
  if (clientIds.length === 0) return new Map<string, number>();
  const rows = await db.booking.groupBy({
    by: ['clientId'],
    where: { clientId: { in: clientIds }, status: { not: 'CANCELLED' } },
    _sum: { totalAmount: true },
  });
  return new Map(rows.map((r) => [r.clientId, r._sum.totalAmount ?? 0]));
}

export async function listClients(db: PrismaClient, filters: ClientFilters) {
  const q = filters.q?.trim();
  const digits = q?.replace(/\D/g, '') ?? '';
  const where: Prisma.ClientWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { company: { contains: q, mode: 'insensitive' } },
          ...(digits.length >= 4 ? [{ normalizedPhone: { contains: digits.replace(/^8/, '7') } }] : []),
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (filters.page - 1) * CLIENTS_PAGE_SIZE,
      take: CLIENTS_PAGE_SIZE,
      include: { _count: { select: { bookings: true, tourRequests: true } } },
    }),
    db.client.count({ where }),
  ]);
  const totals = await totalsFor(db, items.map((c) => c.id));
  return {
    items: items.map((c) => ({ ...c, totalAmount: totals.get(c.id) ?? 0 })),
    total,
    pages: Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE)),
  };
}

/** Other clients that are probably the same person (same email or same name, different phone). */
export async function findDuplicateCandidates(db: PrismaClient, client: { id: string; name: string; email: string | null }) {
  const or: Prisma.ClientWhereInput[] = [{ name: { equals: client.name.trim(), mode: 'insensitive' } }];
  if (client.email) or.push({ email: { equals: client.email, mode: 'insensitive' } });
  return db.client.findMany({
    where: { id: { not: client.id }, OR: or },
    take: 10,
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { bookings: true, tourRequests: true } } },
  });
}

export async function getClientTotal(db: PrismaClient, clientId: string) {
  return (await totalsFor(db, [clientId])).get(clientId) ?? 0;
}

const updateSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(2, 'Имя слишком короткое').max(100),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().max(254).pipe(z.email('Некорректный email'))]),
  company: z.string().trim().max(200),
  notes: z.string().max(5000),
});

export async function updateClient(db: PrismaClient, actor: SessionUser, input: z.input<typeof updateSchema>) {
  const data = updateSchema.parse(input);
  await db.$transaction(async (tx) => {
    const client = await tx.client.findUnique({ where: { id: data.clientId } });
    if (!client) throw new RuleError('Клиент не найден');
    const next = { name: data.name, email: data.email || null, company: data.company || null, notes: data.notes.trim() || null };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => client[k] !== next[k]);
    if (changed.length === 0) return;
    await tx.client.update({ where: { id: client.id }, data: next });
    await logActivity(tx, { userId: actor.id, entityType: 'Client', entityId: client.id, action: 'client.update', metadata: { fields: changed } });
  });
}

/**
 * Merges `sourceId` into `targetId`: moves bookings, tours and leads, fills
 * empty fields, appends notes, deletes the source. Caller must hold clients:merge.
 */
export async function mergeClients(db: PrismaClient, actor: SessionUser, input: { targetId: string; sourceId: string }) {
  if (!input.targetId || !input.sourceId || input.targetId === input.sourceId) throw new RuleError('Выберите двух разных клиентов');
  return db.$transaction(
    async (tx) => {
      const [target, source] = await Promise.all([
        tx.client.findUnique({ where: { id: input.targetId } }),
        tx.client.findUnique({ where: { id: input.sourceId } }),
      ]);
      if (!target || !source) throw new RuleError('Клиент не найден');

      const [bookings, tours, leads] = await Promise.all([
        tx.booking.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
        tx.tourRequest.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
        tx.lead.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      ]);
      const mergedNote = `Объединён с клиентом ${source.name} (${source.phone})${source.notes ? `: ${source.notes}` : ''}`;
      await tx.client.update({
        where: { id: target.id },
        data: {
          email: target.email ?? source.email,
          company: target.company ?? source.company,
          notes: [target.notes, mergedNote].filter(Boolean).join('\n\n'),
        },
      });
      await tx.client.delete({ where: { id: source.id } });
      await logActivity(tx, {
        userId: actor.id,
        entityType: 'Client',
        entityId: target.id,
        action: 'client.merge',
        metadata: {
          sourceId: source.id,
          sourcePhone: maskPhone(source.normalizedPhone),
          moved: { bookings: bookings.count, tours: tours.count, leads: leads.count },
        },
      });
      return { bookings: bookings.count, tours: tours.count, leads: leads.count };
    },
    { isolationLevel: 'Serializable' },
  );
}
