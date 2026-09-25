import 'server-only';
import type { LeadStatus, Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activity';
import type { SessionUser } from '@/lib/auth/service';
import { formatKzPhone, normalizeKzPhone } from '@/lib/phone';
import { studioDayRange } from '@/lib/time';
import { RuleError } from './errors';
import { optionalStudioDateTime } from './zod-helpers';

type Tx = Prisma.TransactionClient;

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'TOUR_SCHEDULED', 'OFFER_SENT', 'WON', 'LOST'] as const;
export const OPEN_LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'TOUR_SCHEDULED', 'OFFER_SENT'];
export const LEAD_SOURCES = ['website-tour', 'website-booking', 'instagram', 'whatsapp', 'phone', 'referral', 'walk-in', 'other'] as const;

// ─── Automatic leads (inside the business transaction) ───────────────────────

/** One lead per tour request (unique tourRequestId) — safe to call repeatedly. */
export async function ensureLeadForTour(tx: Tx, tour: { id: string; clientId: string }) {
  return tx.lead.upsert({
    where: { tourRequestId: tour.id },
    create: { clientId: tour.clientId, tourRequestId: tour.id, status: 'NEW', source: 'website-tour', title: 'Заявка на тур' },
    update: {},
  });
}

/**
 * Links a booking to a lead: reuses the client's open lead (e.g. from a tour)
 * instead of creating a duplicate; otherwise creates one. Idempotent via unique bookingId.
 */
export async function ensureLeadForBooking(tx: Tx, booking: { id: string; clientId: string; totalAmount: number }) {
  const existing = await tx.lead.findUnique({ where: { bookingId: booking.id } });
  if (existing) return existing;
  const open = await tx.lead.findFirst({
    where: { clientId: booking.clientId, bookingId: null, status: { in: OPEN_LEAD_STATUSES } },
    orderBy: { createdAt: 'desc' },
  });
  if (open) {
    return tx.lead.update({ where: { id: open.id }, data: { bookingId: booking.id, expectedAmount: open.expectedAmount ?? booking.totalAmount } });
  }
  return tx.lead.create({
    data: { clientId: booking.clientId, bookingId: booking.id, status: 'NEW', source: 'website-booking', title: 'Заявка на запись', expectedAmount: booking.totalAmount },
  });
}

/** Moves a linked open lead forward automatically (never backwards, never out of WON/LOST). */
export async function advanceLinkedLead(tx: Tx, where: Prisma.LeadWhereUniqueInput, to: LeadStatus, actorId: string | null, reason: string) {
  const lead = await tx.lead.findUnique({ where });
  if (!lead || !OPEN_LEAD_STATUSES.includes(lead.status)) return;
  if (LEAD_STATUSES.indexOf(lead.status) >= LEAD_STATUSES.indexOf(to)) return;
  await tx.lead.update({ where: { id: lead.id }, data: { status: to, ...(to === 'WON' ? { closedAt: new Date() } : {}) } });
  await logActivity(tx, { userId: actorId, entityType: 'Lead', entityId: lead.id, action: 'lead.status', metadata: { from: lead.status, to, auto: reason } });
}

// ─── Manual operations ────────────────────────────────────────────────────────

const optionalDate = optionalStudioDateTime.transform((v) => v ?? null);
const optionalInt = z
  .union([z.literal(''), z.coerce.number().int().min(0).max(100_000_000)])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

const createSchema = z.object({
  clientId: z.string().max(40).optional(),
  name: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().max(254).pipe(z.email('Некорректный email'))]).optional(),
  source: z.enum(LEAD_SOURCES).default('other'),
  title: z.string().trim().max(120).optional(),
  expectedAmount: optionalInt,
  nextContactAt: optionalDate,
  assignedToId: z.string().max(40).optional(),
  notes: z.string().max(5000).optional(),
});

async function assertAssignee(tx: Tx, id: string | null | undefined) {
  if (!id) return null;
  const user = await tx.user.findUnique({ where: { id } });
  if (!user?.active) throw new RuleError('Ответственный не найден или отключён');
  return user.id;
}

/** Creates a lead for an existing client, or finds/creates the client by phone (never a duplicate client). */
export async function createLead(db: PrismaClient, actor: SessionUser, input: z.input<typeof createSchema>) {
  const data = createSchema.parse(input);
  return db.$transaction(async (tx) => {
    let clientId = data.clientId;
    if (clientId) {
      if (!(await tx.client.findUnique({ where: { id: clientId } }))) throw new RuleError('Клиент не найден');
    } else {
      const normalizedPhone = normalizeKzPhone(data.phone);
      if (!normalizedPhone) throw new RuleError('Укажите телефон в формате +7 700 123 45 67');
      if (!data.name || data.name.length < 2) throw new RuleError('Укажите имя клиента');
      const client = await tx.client.upsert({
        where: { normalizedPhone },
        create: { name: data.name, phone: formatKzPhone(normalizedPhone), normalizedPhone, email: data.email || null, source: data.source },
        update: {},
      });
      clientId = client.id;
    }
    const lead = await tx.lead.create({
      data: {
        clientId,
        status: 'NEW',
        source: data.source,
        title: data.title || null,
        expectedAmount: data.expectedAmount,
        nextContactAt: data.nextContactAt,
        assignedToId: await assertAssignee(tx, data.assignedToId || null),
        notes: data.notes?.trim() || null,
      },
    });
    await logActivity(tx, { userId: actor.id, entityType: 'Lead', entityId: lead.id, action: 'lead.create', metadata: { source: data.source } });
    return lead;
  });
}

const moveSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(LEAD_STATUSES),
  lostReason: z.string().trim().max(500).optional(),
});

/**
 * Server-validated status change (kanban drag-and-drop and forms both use it).
 * LOST requires a reason. Repeating the same move is a no-op, so nothing is ever duplicated.
 * WON only closes the lead: the client and any booking already exist and are not re-created.
 */
export async function moveLead(db: PrismaClient, actor: SessionUser, input: z.input<typeof moveSchema>) {
  const data = moveSchema.parse(input);
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) throw new RuleError('Лид не найден');
    if (lead.status === data.status) return lead;
    if (data.status === 'LOST' && (!data.lostReason || data.lostReason.length < 3)) {
      throw new RuleError('Укажите причину отказа (не короче 3 символов)');
    }
    const closing = data.status === 'WON' || data.status === 'LOST';
    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: data.status,
        closedAt: closing ? new Date() : null,
        lostReason: data.status === 'LOST' ? data.lostReason! : null,
      },
    });
    await logActivity(tx, {
      userId: actor.id,
      entityType: 'Lead',
      entityId: lead.id,
      action: 'lead.status',
      metadata: { from: lead.status, to: data.status, ...(data.status === 'LOST' ? { reason: data.lostReason! } : {}) },
    });
    return updated;
  });
}

const updateSchema = z.object({
  leadId: z.string().min(1),
  title: z.string().trim().max(120).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  expectedAmount: optionalInt,
  nextContactAt: optionalDate,
  assignedToId: z.string().max(40).optional(),
  notes: z.string().max(5000).optional(),
});

export async function updateLead(db: PrismaClient, actor: SessionUser, input: z.input<typeof updateSchema>) {
  const data = updateSchema.parse(input);
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) throw new RuleError('Лид не найден');
    const next = {
      title: data.title !== undefined ? data.title || null : lead.title,
      source: data.source ?? lead.source,
      expectedAmount: data.expectedAmount !== undefined ? data.expectedAmount : lead.expectedAmount,
      nextContactAt: data.nextContactAt !== undefined ? data.nextContactAt : lead.nextContactAt,
      assignedToId: data.assignedToId !== undefined ? await assertAssignee(tx, data.assignedToId || null) : lead.assignedToId,
      notes: data.notes !== undefined ? data.notes.trim() || null : lead.notes,
    };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => {
      const a = lead[k];
      const b = next[k];
      return a instanceof Date || b instanceof Date ? (a as Date | null)?.getTime() !== (b as Date | null)?.getTime() : a !== b;
    });
    if (changed.length === 0) return lead;
    const updated = await tx.lead.update({ where: { id: lead.id }, data: next });
    await logActivity(tx, { userId: actor.id, entityType: 'Lead', entityId: lead.id, action: 'lead.update', metadata: { fields: changed } });
    return updated;
  });
}

// ─── Listing ──────────────────────────────────────────────────────────────────

export const LEAD_SORTS = {
  created_desc: { createdAt: 'desc' },
  next_contact: { nextContactAt: { sort: 'asc', nulls: 'last' } },
  amount_desc: { expectedAmount: { sort: 'desc', nulls: 'last' } },
  updated_desc: { updatedAt: 'desc' },
} as const satisfies Record<string, Prisma.LeadOrderByWithRelationInput>;

export const leadFiltersSchema = z.object({
  view: z.enum(['kanban', 'table']).catch('kanban'),
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(LEAD_STATUSES).optional().catch(undefined),
  source: z.string().max(40).optional().catch(undefined),
  assignee: z.string().max(40).optional().catch(undefined),
  overdue: z.enum(['1']).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  sort: z.enum(Object.keys(LEAD_SORTS) as [keyof typeof LEAD_SORTS]).catch('created_desc'),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;
export const LEADS_PAGE_SIZE = 30;

export function leadWhere(f: LeadFilters, me: SessionUser): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [];
  if (f.q) {
    const digits = f.q.replace(/\D/g, '');
    and.push({
      OR: [
        { client: { name: { contains: f.q, mode: 'insensitive' } } },
        { title: { contains: f.q, mode: 'insensitive' } },
        ...(digits.length >= 4 ? [{ client: { normalizedPhone: { contains: digits.replace(/^8/, '7') } } }] : []),
      ],
    });
  }
  if (f.status) and.push({ status: f.status });
  if (f.source) and.push({ source: f.source });
  if (f.assignee === 'me') and.push({ assignedToId: me.id });
  else if (f.assignee === 'none') and.push({ assignedToId: null });
  else if (f.assignee) and.push({ assignedToId: f.assignee });
  if (f.overdue) and.push({ nextContactAt: { lt: new Date() }, status: { in: OPEN_LEAD_STATUSES } });
  if (f.from) and.push({ createdAt: { gte: studioDayRange(f.from).start } });
  if (f.to) and.push({ createdAt: { lt: studioDayRange(f.to).end } });
  return and.length ? { AND: and } : {};
}

export async function listLeads(db: PrismaClient, f: LeadFilters, me: SessionUser) {
  const where = leadWhere(f, me);
  const kanban = f.view === 'kanban';
  const [items, total] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: [LEAD_SORTS[f.sort], { id: 'asc' }],
      skip: kanban ? 0 : (f.page - 1) * LEADS_PAGE_SIZE,
      take: kanban ? 300 : LEADS_PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true, normalizedPhone: true } },
        assignedTo: { select: { id: true, name: true } },
        booking: { select: { id: true, bookingNumber: true } },
        tourRequest: { select: { id: true, requestNumber: true } },
      },
    }),
    db.lead.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE)) };
}
