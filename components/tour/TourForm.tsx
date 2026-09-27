'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCatalog } from '@/components/CatalogContext';
import { useLanguage } from '@/components/LanguageContext';
import { formatLongDate } from '@/lib/contacts';
import { formatKzPhone, formatPhoneInput, normalizeKzPhone } from '@/lib/phone';
import { addDays, todayInStudio } from '@/lib/time';
import { getTranslation } from '@/lib/translations';

type SlotsState = { status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'ready'; times: string[] };

const fieldClass =
  'w-full px-4 py-3 border border-border-light rounded-card bg-white focus:outline-none focus:ring-2 focus:ring-brand-strong';

const FORMATS = [
  ['podcast', 'tourPage.formatPodcast'],
  ['interview', 'tourPage.formatInterview'],
  ['roundtable', 'tourPage.formatRoundtable'],
  ['other', 'tourPage.formatOther'],
] as const;

export function TourForm() {
  const { language } = useLanguage();
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let text: string = getTranslation(language, key);
      for (const [k, v] of Object.entries(vars ?? {})) text = text.replace(`{${k}}`, String(v));
      return text;
    },
    [language],
  );
  const catalog = useCatalog();

  const [today, setToday] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [format, setFormat] = useState('');
  const [agree, setAgree] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [slots, setSlots] = useState<SlotsState>({ status: 'idle' });
  const [reloadToken, setReloadToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ number: string } | null>(null);
  const idempotencyKey = useRef('');
  const successRef = useRef<HTMLHeadingElement>(null);

  const normalizedPhone = normalizeKzPhone(phone);
  const valid = Boolean(date && time && name.trim().length >= 2 && normalizedPhone && agree);

  useEffect(() => {
    setToday(todayInStudio());
    idempotencyKey.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    setTime('');
    if (!date) return;
    const controller = new AbortController();
    setSlots({ status: 'loading' });
    const params = new URLSearchParams({ kind: 'tour', date });
    if (reloadToken) params.set('_', String(reloadToken));
    fetch(`/api/availability?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { slots: { time: string }[] };
        setSlots({ status: 'ready', times: data.slots.map((s) => s.time) });
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setSlots({ status: 'error' });
      });
    return () => controller.abort();
  }, [date, reloadToken]);

  useEffect(() => {
    if (result) successRef.current?.focus();
  }, [result]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          time,
          name,
          phone,
          format,
          agreePrivacy: agree,
          locale: language,
          idempotencyKey: idempotencyKey.current,
          website: honeypot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { requestNumber?: string; message?: string };
      if (res.ok && data.requestNumber) {
        setResult({ number: data.requestNumber });
        return;
      }
      setError(data.message ?? t('booking.networkError'));
      if (res.status === 409 || res.status === 422) setReloadToken(Date.now());
    } catch {
      setError(t('booking.networkError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!catalog.live) {
    return (
      <div className="bg-white rounded-card p-8 border border-border-light" role="alert">
        <p className="mb-6">{t('booking.unavailable')}</p>
        <a href={`https://wa.me/${catalog.contacts.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-primary inline-block">
          WhatsApp
        </a>
      </div>
    );
  }

  if (result) {
    return (
      <div className="bg-white rounded-card p-8 md:p-12 border border-border-light text-center" role="status">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6" aria-hidden="true">
          <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 ref={successRef} tabIndex={-1} className="text-3xl font-bold mb-4 text-text-primary focus:outline-none">
          {t('tourPage.successTitle')}
        </h2>
        <p className="text-text-secondary mb-4">{t('tourPage.successText')}</p>
        <p className="text-text-secondary">{t('tourPage.successNumber')}</p>
        <p className="text-3xl font-bold text-brand-strong mb-6 tracking-wide">{result.number}</p>
        <div className="bg-bg-light p-6 rounded-card mb-8">
          <p className="text-sm text-text-secondary mb-2">{t('tourPage.successWhen')}</p>
          <p className="font-semibold text-text-primary text-lg">
            {formatLongDate(date, language)}, {time}
          </p>
          <p className="text-xs text-text-secondary mt-1">{t('booking.tzSuffix')}</p>
        </div>
        <p className="text-text-secondary mb-8">
          {t('tourPage.successNote', { phone: (normalizedPhone ? formatKzPhone(normalizedPhone) : phone).replace(/ /g, '\u00a0') })}
        </p>
        <div className="flex gap-4 flex-col sm:flex-row justify-center">
          <Link href="/" className="btn-secondary text-center">
            {t('tourPage.home')}
          </Link>
          <a href={`https://wa.me/${catalog.contacts.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-primary text-center">
            {t('tourPage.whatsapp')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card p-5 sm:p-8 md:p-12 border border-border-light">
      <dl className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <dt className="font-bold text-text-primary mb-1">⏱ {t('tourPage.durationLabel')}</dt>
          <dd className="text-text-secondary">{t('tourPage.durationValue', { n: catalog.tourDurationMinutes })}</dd>
        </div>
        <div>
          <dt className="font-bold text-text-primary mb-1">💰 {t('tourPage.costLabel')}</dt>
          <dd className="text-text-secondary">{t('tourPage.costValue')}</dd>
        </div>
      </dl>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div>
          <label htmlFor="tour-date" className="block font-semibold text-text-primary mb-2">
            {t('tourPage.date')}
          </label>
          <input
            id="tour-date"
            type="date"
            value={date}
            min={today || undefined}
            max={today ? addDays(today, catalog.maxAdvanceDays) : undefined}
            onChange={(e) => setDate(e.target.value)}
            required
            aria-required="true"
            className={fieldClass}
          />
        </div>

        <fieldset>
          <legend className="block font-semibold text-text-primary mb-2">{t('tourPage.time')}</legend>
          <div aria-live="polite">
            {!date && <p className="text-text-secondary text-sm">{t('booking.chooseDateFirst')}</p>}
            {date && slots.status === 'loading' && <p className="text-text-secondary text-sm">{t('booking.loadingSlots')}</p>}
            {date && slots.status === 'error' && (
              <div className="flex items-center gap-4" role="alert">
                <p className="text-sm text-red-700">{t('booking.slotsError')}</p>
                <button type="button" onClick={() => setReloadToken(Date.now())} className="text-sm font-semibold text-brand-ink underline">
                  {t('booking.retry')}
                </button>
              </div>
            )}
            {date && slots.status === 'ready' && slots.times.length === 0 && (
              <p className="text-text-secondary text-sm">{t('booking.noSlots')}</p>
            )}
            {date && slots.status === 'ready' && slots.times.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {slots.times.map((slot) => (
                  <label
                    key={slot}
                    className={`text-center py-2 border-2 rounded-xl cursor-pointer font-semibold focus-within:ring-2 focus-within:ring-brand-strong transition ${
                      time === slot ? 'bg-brand-gradient text-on-brand border-transparent' : 'border-border-light hover:border-brand'
                    }`}
                  >
                    <input type="radio" name="tour-time" value={slot} checked={time === slot} onChange={() => setTime(slot)} className="sr-only" />
                    {slot}
                  </label>
                ))}
              </div>
            )}
          </div>
        </fieldset>

        <div>
          <label htmlFor="tour-name" className="block font-semibold text-text-primary mb-2">
            {t('tourPage.name')}
          </label>
          <input
            id="tour-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('tourPage.namePlaceholder')}
            autoComplete="name"
            maxLength={100}
            required
            aria-required="true"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="tour-phone" className="block font-semibold text-text-primary mb-2">
            {t('tourPage.phone')}
          </label>
          <input
            id="tour-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            placeholder="+7 700 123 45 67"
            maxLength={20}
            required
            aria-required="true"
            aria-invalid={phone.length > 3 && !normalizedPhone}
            aria-describedby="tour-phone-hint"
            className={fieldClass}
          />
          <p id="tour-phone-hint" className="text-sm text-text-secondary mt-1">
            {t('booking.phoneHint')}
          </p>
        </div>

        <div>
          <label htmlFor="tour-format" className="block font-semibold text-text-primary mb-2">
            {t('tourPage.format')}
          </label>
          <select id="tour-format" value={format} onChange={(e) => setFormat(e.target.value)} className={fieldClass}>
            <option value="">{t('tourPage.formatNone')}</option>
            {FORMATS.map(([value, key]) => (
              <option key={value} value={value}>
                {t(key)}
              </option>
            ))}
          </select>
        </div>

        <div aria-hidden="true" className="absolute -left-[10000px] w-px h-px overflow-hidden">
          <label htmlFor="tour-website">Website</label>
          <input id="tour-website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            required
            aria-required="true"
            className="w-5 h-5 mt-0.5 accent-brand-strong"
          />
          <span className="text-sm text-text-secondary">
            {t('tourPage.agreeBefore')}
            <Link href="/privacy" className="text-brand-ink underline underline-offset-2" target="_blank">
              {t('tourPage.agreePrivacy')}
            </Link>
            {t('tourPage.agreeAfter')}
          </span>
        </label>

        {error && (
          <p className="p-4 bg-red-50 border border-red-200 rounded-card text-sm text-red-700 font-semibold" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!valid || submitting}
          aria-busy={submitting}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t('tourPage.submitting') : t('tourPage.submit')}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary mt-6">{t('tourPage.confirmNote')}</p>
    </div>
  );
}
