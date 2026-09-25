import { describe, expect, it } from 'vitest';
import { bookingAdminEmail, bookingClientEmail, tourAdminEmail } from '@/lib/notifications/templates';
import { DEFAULT_CANCELLATION_POLICY, policyTexts } from '@/lib/policy';
import { sanitizeError, sanitizeText } from '@/lib/sanitize';

const data = {
  number: 'SS-00001',
  serviceName: 'Starter — только запись',
  roomName: 'Большая студия',
  date: '20.11.2026',
  time: '12:00–13:00',
  durationMinutes: 60,
  participants: 2,
  total: 20_000,
  clientName: '<script>alert(1)</script>',
  clientPhone: '+7 700 000 00 01',
  clientEmail: 'a"b@example.test',
  comment: '<img src=x onerror=alert(1)>\nвторая строка',
  crmUrl: 'http://localhost:3000/admin/bookings/abc',
};

describe('email templates', () => {
  it('escape every user-supplied value in HTML', () => {
    const email = bookingAdminEmail(data);
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<img');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('a&quot;b@example.test');
  });

  it('keep subjects on one line', () => {
    expect(bookingAdminEmail({ ...data, roomName: 'A\r\nBcc: x@y.z' }).subject).not.toMatch(/[\r\n]/);
  });

  it('write to the client in their language, with the cancellation policy', () => {
    const ru = bookingClientEmail(data, 'ru', policyTexts(DEFAULT_CANCELLATION_POLICY, 'ru'));
    const kk = bookingClientEmail(data, 'kk', policyTexts(DEFAULT_CANCELLATION_POLICY, 'kk'));
    expect(ru.subject).toContain('получена');
    expect(ru.html).toContain('более чем за 48 часов');
    expect(ru.html).toContain('Kaspi');
    expect(ru.html).not.toMatch(/налич/i);
    expect(kk.subject).toContain('қабылданды');
    expect(kk.html).toContain('48');
    expect(kk.html).not.toContain('<script>');
  });

  it('tour notification escapes input', () => {
    const email = tourAdminEmail({ number: 'T-00001', date: '20.11.2026', time: '15:00–15:15', clientName: '<b>x</b>', clientPhone: '+7', crmUrl: 'u' });
    expect(email.html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('sanitizeError', () => {
  it('removes emails, phone numbers and tokens and caps length', () => {
    const text = sanitizeText('Invalid recipient client@example.com phone +7 700 123 45 67 token ya29.a0AfH6SMBx');
    expect(text).not.toContain('client@example.com');
    expect(text).not.toContain('700 123');
    expect(text).not.toContain('ya29');
    expect(sanitizeText('x'.repeat(2000)).length).toBeLessThanOrEqual(501);
  });
  it('includes error codes', () => {
    const error = Object.assign(new Error('boom'), { code: 'EAUTH' });
    expect(sanitizeError(error)).toBe('[EAUTH] Error: boom');
  });
});
