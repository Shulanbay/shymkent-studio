// Structured server logging: one JSON object per line on stdout/stderr, which
// Vercel, Docker and any log collector can index. Personal data and secrets are
// redacted before anything is written. Edge-safe (no Node APIs).

import { sanitizeText } from '@/lib/sanitize';

type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

const SENSITIVE_KEY = /pass|token|secret|authorization|cookie|session|email|phone|name|comment|address|ip$/i;
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): number {
  const configured = (process.env.LOG_LEVEL ?? '').toLowerCase() as Level;
  return LEVELS[configured] ?? (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);
}

/** Replaces sensitive keys and scrubs emails / phones / tokens from strings. */
export function redact(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return sanitizeText(value, 1000);
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return { name: value.name, message: sanitizeText(value.message, 500), ...(code != null ? { code: String(code) } : {}) };
  }
  if (depth > 4) return '[depth]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Fields = {};
    // Flags and counters under a sensitive-looking key (e.g. integrations.email = true) are harmless.
    for (const [k, v] of Object.entries(value as Fields)) out[k] = SENSITIVE_KEY.test(k) && typeof v === 'string' ? '[redacted]' : redact(v, depth + 1);
    return out;
  }
  return String(value);
}

function write(level: Level, msg: string, fields?: Fields) {
  if (LEVELS[level] < minLevel()) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...((redact(fields ?? {}) as Fields) ?? {}) });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: Fields) => write('debug', msg, fields),
  info: (msg: string, fields?: Fields) => write('info', msg, fields),
  warn: (msg: string, fields?: Fields) => write('warn', msg, fields),
  error: (msg: string, fields?: Fields) => write('error', msg, fields),
};

export const REQUEST_ID_HEADER = 'x-request-id';

/** Request id set by middleware (or the proxy), for correlating log lines. */
export function requestIdOf(headers: Headers): string | undefined {
  const id = headers.get(REQUEST_ID_HEADER);
  return id && /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : undefined;
}
