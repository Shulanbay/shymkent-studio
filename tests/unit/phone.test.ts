import { describe, expect, it } from 'vitest';
import { formatKzPhone, formatPhoneInput, maskPhone, normalizeKzPhone } from '@/lib/phone';

describe('normalizeKzPhone', () => {
  it.each(['+7 700 123 45 67', '+77001234567', '87001234567', '8 (700) 123-45-67', '7001234567', '77001234567', '+7 (700) 123 45 67', '8-700-123-45-67'])(
    '%s → +77001234567',
    (input) => {
      expect(normalizeKzPhone(input)).toBe('+77001234567');
    },
  );

  it.each(['', '123', '+1 202 555 0100', '+7 000 123 45 67', '700123456', '+7 700 123 45 678', '7001234567abc', '++77001234567', '7+7001234567', 42, null])(
    'rejects %s',
    (input) => {
      expect(normalizeKzPhone(input)).toBeNull();
    },
  );
});

describe('phone formatting', () => {
  it('formats normalised numbers for display', () => {
    expect(formatKzPhone('+77001234567')).toBe('+7 700 123 45 67');
  });
  it('formats as the user types', () => {
    expect(formatPhoneInput('8700')).toBe('+7 700');
    expect(formatPhoneInput('87001234567')).toBe('+7 700 123 45 67');
    expect(formatPhoneInput('+7 700 123 45 67 89')).toBe('+7 700 123 45 67');
    expect(formatPhoneInput('')).toBe('');
  });
  it('masks numbers for logs', () => {
    expect(maskPhone('+77001234567')).toBe('+7 700 *** ** 67');
  });
});
