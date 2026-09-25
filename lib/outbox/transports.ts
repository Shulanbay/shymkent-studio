import 'server-only';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { isDryRun } from '@/lib/integrations/config';
import { createGoogleOAuthClient, getGoogleRefreshToken } from '@/lib/integrations/google';

// Adapters to external services. Handlers only talk to this interface, so
// tests (and dry-run mode) substitute a recorder that never leaves the process.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  colorId?: string | null;
}

export interface Transports {
  readonly kind: 'real' | 'recording';
  /** Returns the provider message id (SMTP Message-ID) when available. */
  sendEmail(message: EmailMessage): Promise<string | null>;
  calendarUpsert(eventId: string, event: CalendarEventInput): Promise<void>;
  calendarDelete(eventId: string): Promise<void>;
  /**
   * Insert-or-update a row identified by `key` (booking number). The Apps Script
   * web app must implement the upsert (see docs/INTEGRATIONS.md).
   */
  sheetsUpsert(key: string, row: Record<string, string | number>): Promise<void>;
}

type Channel = 'email' | 'calendar' | 'sheets';

/** In-memory transport for tests / dry-run. Can simulate outages per channel. */
export class RecordingTransports implements Transports {
  readonly kind = 'recording' as const;
  emails: EmailMessage[] = [];
  calendar = new Map<string, CalendarEventInput>();
  /** Keyed by booking number — upserts replace, like the real sheet. */
  sheets = new Map<string, Record<string, string | number>>();
  calendarDeletes: string[] = [];
  failing = new Set<Channel>();

  private guard(channel: Channel) {
    if (this.failing.has(channel)) throw new Error(`${channel} unavailable (simulated)`);
  }
  async sendEmail(message: EmailMessage) {
    this.guard('email');
    this.emails.push(message);
    return `<dry-run-${this.emails.length}@shymkent.studio>`;
  }
  async calendarUpsert(eventId: string, event: CalendarEventInput) {
    this.guard('calendar');
    this.calendar.set(eventId, event);
  }
  async calendarDelete(eventId: string) {
    this.guard('calendar');
    this.calendarDeletes.push(eventId);
    this.calendar.delete(eventId);
  }
  async sheetsUpsert(key: string, row: Record<string, string | number>) {
    this.guard('sheets');
    this.sheets.set(key, row);
  }
  reset() {
    this.emails = [];
    this.calendar.clear();
    this.sheets.clear();
    this.calendarDeletes = [];
    this.failing.clear();
  }
}

function createMailer() {
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

function httpStatus(error: unknown): number | undefined {
  const e = error as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  const value = e?.response?.status ?? e?.status ?? e?.code;
  return typeof value === 'number' ? value : undefined;
}

export function createRealTransports(): Transports {
  const calendarClient = async () => {
    const refreshToken = await getGoogleRefreshToken();
    if (!refreshToken) throw new Error('Google Calendar is not connected (no refresh token)');
    const auth = createGoogleOAuthClient();
    auth.setCredentials({ refresh_token: refreshToken });
    return google.calendar({ version: 'v3', auth });
  };
  const calendarId = () => {
    const id = process.env.GOOGLE_CALENDAR_ID;
    if (!id) throw new Error('GOOGLE_CALENDAR_ID is not set');
    return id;
  };

  return {
    kind: 'real',
    async sendEmail(message) {
      const from = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;
      const info = await createMailer().sendMail({ from, ...message });
      return typeof info.messageId === 'string' ? info.messageId : null;
    },
    async calendarUpsert(eventId, event) {
      const calendar = await calendarClient();
      const requestBody = {
        id: eventId,
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.start.toISOString(), timeZone: 'Asia/Almaty' },
        end: { dateTime: event.end.toISOString(), timeZone: 'Asia/Almaty' },
        colorId: event.colorId ?? undefined,
        status: 'confirmed',
      };
      try {
        await calendar.events.insert({ calendarId: calendarId(), requestBody });
      } catch (error) {
        // 409: an event with this deterministic id already exists → update it (idempotent retry).
        if (httpStatus(error) !== 409) throw error;
        await calendar.events.update({ calendarId: calendarId(), eventId, requestBody });
      }
    },
    async calendarDelete(eventId) {
      const calendar = await calendarClient();
      try {
        await calendar.events.delete({ calendarId: calendarId(), eventId });
      } catch (error) {
        const status = httpStatus(error);
        if (status !== 404 && status !== 410) throw error;
      }
    },
    async sheetsUpsert(key, row) {
      const url = process.env.GOOGLE_APPS_SCRIPT_URL;
      if (!url) throw new Error('GOOGLE_APPS_SCRIPT_URL is not set');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Legacy scripts that only append still receive every row field at the top level.
        body: JSON.stringify({ action: 'upsert', key, ...row }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Google Sheets responded with HTTP ${response.status}`);
    },
  };
}

const globalForTransports = globalThis as unknown as { __ssRecordingTransports?: RecordingTransports };

/** Shared recorder used whenever integrations run in dry-run (tests, INTEGRATIONS_DRY_RUN=true). */
export function getRecordingTransports(): RecordingTransports {
  globalForTransports.__ssRecordingTransports ??= new RecordingTransports();
  return globalForTransports.__ssRecordingTransports;
}

export function getTransports(): Transports {
  return isDryRun() ? getRecordingTransports() : createRealTransports();
}
