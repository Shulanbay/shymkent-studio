// Makes error messages safe to store and show in the CRM: removes email
// addresses, phone numbers and token-like strings, and caps the length.

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+?\d[\d\s()-]{8,}\d/g;
const TOKEN_RE = /\b(?:ya29\.[\w-]+|1\/\/[\w-]+|[A-Za-z0-9_-]{32,})\b/g;

export function sanitizeText(value: string, maxLength = 500): string {
  const cleaned = value.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]').replace(TOKEN_RE, '[redacted]');
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    const prefix = typeof code === 'string' || typeof code === 'number' ? `[${code}] ` : '';
    return sanitizeText(`${prefix}${error.name}: ${error.message}`);
  }
  return sanitizeText(String(error));
}
