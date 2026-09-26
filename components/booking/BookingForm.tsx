'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatPrice, useCatalog } from '@/components/CatalogContext';
import { useLanguage } from '@/components/LanguageContext';
import { useCancellationPolicy } from '@/components/PolicyContext';
import { formatKzPhone, formatPhoneInput, normalizeKzPhone } from '@/lib/phone';
import { policyTexts } from '@/lib/policy';
import { computeBookingPrice, durationOptions } from '@/lib/pricing';
import { normalizeServiceSlug } from '@/lib/services';
import { addDays, todayInStudio } from '@/lib/time';
import { getTranslation } from '@/lib/translations';

interface Slot {
  time: string;
  startAt: string;
  endAt: string;
}

type SlotsState = { status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'ready'; slots: Slot[] };

const SLOT_ERROR_CODES = new Set(['SLOT_TAKEN', 'PAST', 'TOO_SOON', 'TOO_FAR', 'CLOSED', 'OUTSIDE_HOURS', 'OFF_GRID', 'INVALID_DATE']);

const fieldClass =
  'w-full px-4 py-3 border border-border-light rounded-card bg-white focus:outline-none focus:ring-2 focus:ring-orange-accent';

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
      );
}

function formatLocalDate(date: string, language: 'ru' | 'kk') {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(language === 'kk' ? 'kk-KZ' : 'ru-RU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function BookingForm() {
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
  const policy = useCancellationPolicy();
  const searchParams = useSearchParams();

  const initialService =
    catalog.services.find((s) => s.slug === normalizeServiceSlug(searchParams.get('service')))?.slug ??
    catalog.services.find((s) => s.slug === 'pro')?.slug ??
    catalog.services[0]?.slug ??
    '';
  const initialRoom =
    catalog.rooms.find((r) => r.slug === searchParams.get('room'))?.slug ?? catalog.rooms[0]?.slug ?? '';

  const [step, setStep] = useState(1);
  const [serviceSlug, setServiceSlug] = useState(initialService);
  const [roomSlug, setRoomSlug] = useState(initialRoom);
  const [participants, setParticipants] = useState(1);
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [agree, setAgree] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [slots, setSlots] = useState<SlotsState>({ status: 'idle' });
  const [reloadToken, setReloadToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; slotProblem: boolean } | null>(null);
  const [result, setResult] = useState<{ number: string } | null>(null);
  const [today, setToday] = useState('');
  const idempotencyKey = useRef<string>('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  const service = catalog.services.find((s) => s.slug === serviceSlug);
  const room = catalog.rooms.find((r) => r.slug === roomSlug);
  const durations = useMemo(() => (service ? durationOptions(service) : []), [service]);
  const price = service && duration ? computeBookingPrice(service, duration) : null;
  const normalizedPhone = normalizeKzPhone(phone);

  useEffect(() => {
    setToday(todayInStudio());
    idempotencyKey.current = newKey();
  }, []);

  // Keep dependent fields valid when the tariff or room changes.
  useEffect(() => {
    if (service && !durations.includes(duration)) setDuration(service.defaultDuration);
  }, [service, durations, duration]);
  useEffect(() => {
    if (room && participants > room.capacity) setParticipants(room.capacity);
  }, [room, participants]);

  // Any change of what is being booked invalidates the chosen time.
  useEffect(() => {
    setTime('');
  }, [serviceSlug, roomSlug, date, duration]);

  useEffect(() => {
    if (step > 1) headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!date || !serviceSlug || !roomSlug || !duration || step < 3 || result) return;
    const controller = new AbortController();
    setSlots({ status: 'loading' });
    const params = new URLSearchParams({ room: roomSlug, service: serviceSlug, date, duration: String(duration) });
    if (reloadToken) params.set('_', String(reloadToken));
    fetch(`/api/availability?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { slots: Slot[] };
        setSlots({ status: 'ready', slots: data.slots });
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') setSlots({ status: 'error' });
      });
    return () => controller.abort();
  }, [date, serviceSlug, roomSlug, duration, reloadToken, step, result]);

  const contactsValid = name.trim().length >= 2 && Boolean(normalizedPhone) && agree && (!email || /.+@.+\..+/.test(email));

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: serviceSlug,
          room: roomSlug,
          date,
          time,
          duration,
          participants,
          name,
          phone,
          email,
          comment,
          agreeTerms: agree,
          locale: language,
          idempotencyKey: idempotencyKey.current,
          website: honeypot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { bookingNumber?: string; error?: string; message?: string };
      if (res.ok && data.bookingNumber) {
        setResult({ number: data.bookingNumber });
        setStep(6);
        return;
      }
      const slotProblem = res.status === 409 || SLOT_ERROR_CODES.has(data.error ?? '');
      setSubmitError({ message: data.message ?? t('booking.networkError'), slotProblem });
      if (slotProblem) {
        setTime('');
        setReloadToken(Date.now());
      }
    } catch {
      setSubmitError({ message: t('booking.networkError'), slotProblem: false });
    } finally {
      setSubmitting(false);
    }
  }

  const serviceName = (s = service) => (s ? (language === 'kk' ? s.nameKk : s.nameRu) : '');
  const roomName = (r = room) => (r ? (language === 'kk' ? r.nameKk : r.nameRu) : '');

  if (!catalog.live || !service || !room) {
    return (
      <div className="bg-white rounded-card p-8 border border-border-light" role="alert">
        <p className="text-text-primary mb-6">{t('booking.unavailable')}</p>
        <a href={`https://wa.me/${catalog.contacts.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-primary inline-block">
          WhatsApp
        </a>
      </div>
    );
  }

  const heading = (text: string) => (
    <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold mb-6 text-text-primary focus:outline-none">
      {text}
    </h2>
  );

  const selectedBorder = (selected: boolean) => ({ borderColor: selected ? '#FF6B24' : '#EDE5DD' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-card p-5 sm:p-8 border border-border-light">
          {step === 1 && (
            <fieldset>
              <legend className="sr-only">{t('booking.step1Title')}</legend>
              {heading(t('booking.step1Title'))}
              <div className="space-y-4">
                {catalog.services.map((s) => (
                  <label
                    key={s.slug}
                    className="flex items-center gap-4 p-4 border-2 rounded-card cursor-pointer hover:border-orange-accent focus-within:ring-2 focus-within:ring-orange-accent transition"
                    style={selectedBorder(serviceSlug === s.slug)}
                  >
                    <input
                      type="radio"
                      name="service"
                      value={s.slug}
                      checked={serviceSlug === s.slug}
                      onChange={() => setServiceSlug(s.slug)}
                      className="w-5 h-5 accent-orange-accent"
                    />
                    <span className="flex-grow min-w-0">
                      <span className="block font-semibold text-text-primary">{serviceName(s)}</span>
                      <span className="block text-sm text-text-secondary">{language === 'kk' ? s.descriptionKk : s.descriptionRu}</span>
                    </span>
                    <span className="text-lg font-bold text-orange-accent whitespace-nowrap">{formatPrice(s.basePrice)} ₸</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setStep(2)} className="btn-primary flex-grow">
                  {t('booking.next')}
                </button>
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <div>
              {heading(t('booking.step2Title'))}
              <fieldset className="space-y-4">
                <legend className="sr-only">{t('booking.room')}</legend>
                {catalog.rooms.map((r) => (
                  <label
                    key={r.slug}
                    className="flex items-center gap-4 p-4 border-2 rounded-card cursor-pointer hover:border-orange-accent focus-within:ring-2 focus-within:ring-orange-accent transition"
                    style={selectedBorder(roomSlug === r.slug)}
                  >
                    <input
                      type="radio"
                      name="room"
                      value={r.slug}
                      checked={roomSlug === r.slug}
                      onChange={() => setRoomSlug(r.slug)}
                      className="w-5 h-5 accent-orange-accent"
                    />
                    <span className="flex-grow min-w-0">
                      <span className="block font-semibold text-text-primary">{roomName(r)}</span>
                      <span className="block text-sm text-text-secondary">{t('booking.participantsMax', { n: r.capacity })}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="mt-6">
                <label htmlFor="participants" className="block font-semibold text-text-primary mb-2">
                  {t('booking.participantsLabel')}
                </label>
                <select
                  id="participants"
                  value={participants}
                  onChange={(e) => setParticipants(Number(e.target.value))}
                  className={fieldClass}
                >
                  {Array.from({ length: room.capacity }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {t('booking.personsUnit')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-grow">
                  {t('booking.back')}
                </button>
                <button type="button" onClick={() => setStep(3)} className="btn-primary flex-grow">
                  {t('booking.next')}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              {heading(t('booking.step3Title'))}
              <div className="space-y-6">
                <div>
                  <label htmlFor="date" className="block font-semibold text-text-primary mb-2">
                    {t('booking.recordingDate')}
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={date}
                    min={today || undefined}
                    max={today ? addDays(today, catalog.maxAdvanceDays) : undefined}
                    onChange={(e) => setDate(e.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div>
                  {durations.length > 1 ? (
                    <>
                      <label htmlFor="duration" className="block font-semibold text-text-primary mb-2">
                        {t('booking.recordingDuration')}
                      </label>
                      <select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={fieldClass}>
                        {durations.map((d) => {
                          const p = computeBookingPrice(service, d);
                          return (
                            <option key={d} value={d}>
                              {d} {t('booking.minutes')} — {p.ok ? `${formatPrice(p.total)} ₸` : ''}
                            </option>
                          );
                        })}
                      </select>
                      {service.extraStepMinutes && service.extraStepPrice && (
                        <p className="text-sm text-text-secondary mt-2">
                          {t('booking.extraStepNote', { minutes: service.extraStepMinutes, price: formatPrice(service.extraStepPrice) })}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-text-secondary">{t('booking.fixedDuration', { n: service.defaultDuration })}</p>
                  )}
                </div>

                <fieldset>
                  <legend className="block font-semibold text-text-primary mb-1">{t('booking.availableTimes')}</legend>
                  <p className="text-sm text-text-secondary mb-3">{t('booking.recordingTime')}</p>
                  <div aria-live="polite">
                    {!date && <p className="text-text-secondary">{t('booking.chooseDateFirst')}</p>}
                    {date && slots.status === 'loading' && <p className="text-text-secondary">{t('booking.loadingSlots')}</p>}
                    {date && slots.status === 'error' && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-card flex flex-wrap items-center gap-4" role="alert">
                        <p className="text-sm text-red-700">{t('booking.slotsError')}</p>
                        <button type="button" onClick={() => setReloadToken(Date.now())} className="btn-secondary text-sm px-4 py-2">
                          {t('booking.retry')}
                        </button>
                      </div>
                    )}
                    {date && slots.status === 'ready' && slots.slots.length === 0 && (
                      <p className="text-text-secondary">{t('booking.noSlots')}</p>
                    )}
                    {date && slots.status === 'ready' && slots.slots.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {slots.slots.map((slot) => (
                          <label
                            key={slot.time}
                            className={`text-center py-2 border-2 rounded-xl cursor-pointer font-semibold focus-within:ring-2 focus-within:ring-orange-accent transition ${
                              time === slot.time ? 'bg-orange-accent text-white border-orange-accent' : 'border-border-light hover:border-orange-accent'
                            }`}
                          >
                            <input
                              type="radio"
                              name="time"
                              value={slot.time}
                              checked={time === slot.time}
                              onChange={() => setTime(slot.time)}
                              className="sr-only"
                            />
                            {slot.time}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </fieldset>
                {submitError?.slotProblem && (
                  <p className="text-sm text-red-700" role="alert">
                    {submitError.message}
                  </p>
                )}
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-grow">
                  {t('booking.back')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={!time}
                  className="btn-primary flex-grow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('booking.next')}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (contactsValid) setStep(5);
              }}
              noValidate
            >
              {heading(t('booking.step4Title'))}
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block font-semibold text-text-primary mb-2">
                    {t('booking.nameLabel')}
                  </label>
                  <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('booking.namePlaceholder')}
                    autoComplete="name"
                    maxLength={100}
                    required
                    aria-required="true"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block font-semibold text-text-primary mb-2">
                    {t('booking.phoneLabel')}
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    placeholder={t('booking.phonePlaceholder')}
                    maxLength={20}
                    required
                    aria-required="true"
                    aria-invalid={phone.length > 3 && !normalizedPhone}
                    aria-describedby="phone-hint"
                    className={fieldClass}
                  />
                  <p id="phone-hint" className="text-sm text-text-secondary mt-1">
                    {t('booking.phoneHint')}
                  </p>
                </div>
                <div>
                  <label htmlFor="email" className="block font-semibold text-text-primary mb-2">
                    {t('booking.emailLabel')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('booking.emailPlaceholder')}
                    maxLength={254}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="comment" className="block font-semibold text-text-primary mb-2">
                    {t('booking.commentLabel')}
                  </label>
                  <textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t('booking.commentPlaceholder')}
                    maxLength={1000}
                    className={`${fieldClass} min-h-24`}
                  />
                </div>
                {/* Honeypot: invisible to people, filled by naive bots. */}
                <div aria-hidden="true" className="absolute -left-[10000px] w-px h-px overflow-hidden">
                  <label htmlFor="website">Website</label>
                  <input id="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </div>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    required
                    aria-required="true"
                    className="w-5 h-5 mt-0.5 accent-orange-accent"
                  />
                  <span className="text-sm text-text-secondary">
                    {t('booking.agreeBefore')}
                    <Link href="/terms" className="text-orange-accent underline underline-offset-2" target="_blank">
                      {t('footer.terms')}
                    </Link>
                    {t('booking.agreeBetween')}
                    <Link href="/privacy" className="text-orange-accent underline underline-offset-2" target="_blank">
                      {t('footer.privacy')}
                    </Link>
                    {t('booking.agreeAfter')}
                  </span>
                </label>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setStep(3)} className="btn-secondary flex-grow">
                  {t('booking.back')}
                </button>
                <button type="submit" disabled={!contactsValid} className="btn-primary flex-grow disabled:opacity-50 disabled:cursor-not-allowed">
                  {t('booking.checkout')}
                </button>
              </div>
            </form>
          )}

          {step === 5 && (
            <div>
              {heading(t('booking.step5Title'))}
              <dl className="space-y-3 mb-8 p-4 sm:p-6 bg-bg-light rounded-card">
                {[
                  [t('booking.service'), serviceName()],
                  [t('booking.room'), roomName()],
                  [t('booking.dateAndTime'), `${formatLocalDate(date, language)}, ${time}`],
                  [t('booking.duration'), `${duration} ${t('booking.minutes')}`],
                  [t('booking.participants'), String(participants)],
                  [t('booking.phoneLabel').replace(' *', ''), (normalizedPhone ? formatKzPhone(normalizedPhone) : phone).replace(/ /g, '\u00a0')],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-border-light pb-3">
                    <dt className="text-text-secondary">{label}</dt>
                    <dd className="font-semibold text-text-primary text-right">{value}</dd>
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <dt className="text-lg font-semibold text-text-primary">{t('booking.total')}</dt>
                  <dd className="text-2xl font-bold text-orange-accent">{price?.ok ? `${formatPrice(price.total)} ₸` : '—'}</dd>
                </div>
              </dl>
              <div className="p-4 bg-orange-accent/10 rounded-card border border-orange-accent/20 mb-6">
                <p className="text-sm text-text-primary">{t('booking.prepayment')}</p>
              </div>
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-card mb-6" role="alert">
                  <p className="text-sm text-red-700 font-semibold">{submitError.message}</p>
                  {submitError.slotProblem && (
                    <button type="button" onClick={() => setStep(3)} className="mt-3 text-sm font-semibold text-orange-accent underline">
                      {t('booking.chooseOtherTime')}
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-4">
                <button type="button" onClick={() => setStep(4)} className="btn-secondary flex-grow" disabled={submitting}>
                  {t('booking.back')}
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  aria-busy={submitting}
                  className="btn-primary flex-grow disabled:opacity-60 disabled:cursor-wait"
                >
                  {submitting ? t('booking.submitting') : t('booking.submitRequest')}
                </button>
              </div>
            </div>
          )}

          {step === 6 && result && (
            <div className="text-center py-8" role="status">
              <svg className="w-16 h-16 text-green-600 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h2 ref={headingRef} tabIndex={-1} className="text-3xl font-bold mb-4 text-text-primary focus:outline-none">
                {t('booking.successTitle')}
              </h2>
              <p className="text-text-secondary mb-1">{t('booking.successNumber')}</p>
              <p className="text-3xl font-bold text-orange-accent mb-6 tracking-wide">{result.number}</p>
              <p className="text-text-secondary mb-8 max-w-md mx-auto">
                {t('booking.successText', { phone: (normalizedPhone ? formatKzPhone(normalizedPhone) : phone).replace(/ /g, '\u00a0') })}
              </p>
              <div className="bg-bg-light border border-border-light rounded-card p-6 mb-8 text-left space-y-2 text-sm text-text-secondary">
                <p>
                  <span className="font-semibold text-text-primary">{t('booking.service')}:</span> {serviceName()}
                </p>
                <p>
                  <span className="font-semibold text-text-primary">{t('booking.room')}:</span> {roomName()}
                </p>
                <p>
                  <span className="font-semibold text-text-primary">{t('booking.dateAndTime')}:</span> {formatLocalDate(date, language)}, {time}
                </p>
                <p>
                  <span className="font-semibold text-text-primary">Email:</span> {email || t('booking.emailNotProvided')}
                </p>
              </div>
              <Link href="/" className="btn-primary inline-block">
                {t('booking.backHome')}
              </Link>
            </div>
          )}
        </div>
      </div>

      <aside className="lg:col-span-1" aria-label={t('booking.orderSummary')}>
        <div className="lg:sticky top-24 bg-white rounded-card p-6 border border-border-light">
          <h2 className="font-bold text-text-primary mb-4 text-lg">{t('booking.orderSummary')}</h2>
          <dl className="space-y-4 mb-6 pb-6 border-b border-border-light">
            <div>
              <dt className="text-sm text-text-secondary">{t('booking.service')}</dt>
              <dd className="font-semibold text-text-primary">{serviceName()}</dd>
            </div>
            {step >= 2 && (
              <div>
                <dt className="text-sm text-text-secondary">{t('booking.room')}</dt>
                <dd className="font-semibold text-text-primary">{roomName()}</dd>
              </div>
            )}
            {step >= 3 && date && (
              <div>
                <dt className="text-sm text-text-secondary">{t('booking.dateAndTime')}</dt>
                <dd className="font-semibold text-text-primary">
                  {formatLocalDate(date, language)}
                  {time ? `, ${time}` : ''}
                </dd>
              </div>
            )}
          </dl>
          <p className="text-sm text-text-secondary mb-2">{t('booking.cost')}</p>
          <p className="text-3xl font-bold text-orange-accent">
            {formatPrice(price?.ok ? price.total : service.basePrice)} ₸
          </p>
          <div className="mt-6 p-4 bg-bg-light rounded-card text-sm text-text-secondary space-y-2">
            <p>{t('booking.prepaymentCheck')}</p>
            <p>{t('booking.whatsappConfirm')}</p>
            <p>{policyTexts(policy, language).short}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
