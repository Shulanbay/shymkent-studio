// Kazakhstan phone numbers (+7, shared numbering plan with Russia).
// Pure module, used on both server (source of truth) and client (formatting).

/**
 * Normalises a phone number to E.164 (+7XXXXXXXXXX), or returns null.
 * Accepts: +7 700 123 45 67, 87001234567, 8 (700) 123-45-67, 7001234567, 77001234567.
 */
export function normalizeKzPhone(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 32) return null;
  if (/[^\d\s()+\-.]/.test(input)) return null;
  if (input.indexOf('+') > 0 || (input.match(/\+/g)?.length ?? 0) > 1) return null;
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length !== 11 || !digits.startsWith('7')) return null;
  // Subscriber part cannot start with 0, 1 or 2 in the +7 plan.
  if (!/^7[3-9]\d{9}$/.test(digits)) return null;
  return `+${digits}`;
}

/** "+77001234567" → "+7 700 123 45 67" */
export function formatKzPhone(normalized: string): string {
  const d = normalized.replace(/\D/g, '');
  if (d.length !== 11) return normalized;
  return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}

/** As-you-type formatting for input fields. Never rejects input. */
export function formatPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '').slice(0, 11);
  if (!digits) return raw.startsWith('+') ? '+' : '';
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith('7')) digits = `7${digits}`.slice(0, 11);
  const parts = [digits.slice(1, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)].filter(Boolean);
  return `+7${parts.length ? ' ' + parts.join(' ') : ''}`;
}

/** For logs/CRM lists where the full number is not needed: "+7 700 *** ** 67". */
export function maskPhone(normalized: string): string {
  const d = normalized.replace(/\D/g, '');
  if (d.length !== 11) return '***';
  return `+${d[0]} ${d.slice(1, 4)} *** ** ${d.slice(9)}`;
}
