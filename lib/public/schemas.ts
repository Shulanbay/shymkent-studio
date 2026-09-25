import { z } from 'zod';

// Strict server-side validation of public forms. Unknown fields (e.g. a
// "price" sent by a tampered client) are stripped and never used.

// Removes control characters except newlines/tabs in multi-line text.
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
const singleLine = (value: string) => clean(value).replace(/[\r\n\t]+/g, ' ');

const name = z.string().trim().min(2).max(100).transform(singleLine);
const optionalEmail = z
  .union([z.literal(''), z.string().trim().toLowerCase().max(254).pipe(z.email())])
  .optional()
  .transform((v) => (v ? v : undefined));

export const publicBookingSchema = z.object({
  service: z.string().trim().min(1).max(32),
  room: z.string().trim().regex(/^[a-z0-9-]{1,32}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration: z.coerce.number().int().min(15).max(600),
  participants: z.coerce.number().int().min(1).max(20),
  name,
  phone: z.string().trim().min(5).max(32),
  email: optionalEmail,
  comment: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? clean(v) : undefined)),
  agreeTerms: z.literal(true),
  locale: z.enum(['ru', 'kk']).default('ru'),
  idempotencyKey: z.uuid(),
});
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

export const TOUR_FORMATS = ['podcast', 'interview', 'roundtable', 'other'] as const;

export const publicTourSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  name,
  phone: z.string().trim().min(5).max(32),
  format: z
    .union([z.literal(''), z.enum(TOUR_FORMATS)])
    .optional()
    .transform((v) => (v ? v : undefined)),
  agreePrivacy: z.literal(true),
  locale: z.enum(['ru', 'kk']).default('ru'),
  idempotencyKey: z.uuid(),
});
export type PublicTourInput = z.infer<typeof publicTourSchema>;

export const availabilityQuerySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('booking'),
    room: z.string().regex(/^[a-z0-9-]{1,32}$/),
    service: z.string().min(1).max(32),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    duration: z.coerce.number().int().min(15).max(600).optional(),
  }),
  z.object({
    kind: z.literal('tour'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

/** Honeypot: a hidden field real users never fill in. */
export const HONEYPOT_FIELD = 'website';

export function isHoneypotTriggered(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const value = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  return typeof value === 'string' ? value.trim().length > 0 : value != null && value !== '';
}

export const TERMS_VERSION = '2026-09';

export function formatBookingNumber(n: number): string {
  return `SS-${String(n).padStart(5, '0')}`;
}

export function formatTourNumber(n: number): string {
  return `T-${String(n).padStart(5, '0')}`;
}
