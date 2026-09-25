import { describe, expect, it } from 'vitest';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth/password';
import { safeAdminRedirect } from '@/lib/auth/redirect';
import { generateSessionToken, hashSessionToken, keyedHash, safeEqual } from '@/lib/auth/tokens';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { escapeHtml } from '@/lib/html';
import { normalizeServiceSlug } from '@/lib/services';

describe('password hashing (argon2id)', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse batterY')).toBe(false);
  });
  it('returns false for a missing hash or garbage', async () => {
    expect(await verifyPassword(null, 'anything')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
  it('enforces minimum strength', () => {
    expect(validatePasswordStrength('short')).not.toBeNull();
    expect(validatePasswordStrength('aaaaaaaaaaaaaaa')).not.toBeNull();
    expect(validatePasswordStrength('Studio-Shymkent-2026')).toBeNull();
  });
});

describe('session tokens', () => {
  it('are random and stored only as a hash', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashSessionToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(a)).not.toContain(a);
  });
  it('keyed hashes depend on the secret', () => {
    expect(keyedHash('s1', '1.2.3.4')).not.toBe(keyedHash('s2', '1.2.3.4'));
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });
});

describe('safeAdminRedirect', () => {
  it.each([
    ['/admin/users', '/admin/users'],
    ['/admin?tab=1', '/admin?tab=1'],
    ['/admin', '/admin'],
    ['//evil.com/admin', '/admin'],
    ['https://evil.com/admin', '/admin'],
    ['/administrator', '/admin'],
    ['/admin/login', '/admin'],
    ['/\\evil.com', '/admin'],
    [undefined, '/admin'],
  ])('%s → %s', (input, expected) => {
    expect(safeAdminRedirect(input)).toBe(expected);
  });
});

describe('secret encryption', () => {
  const secret = 'x'.repeat(48);
  it('round-trips', () => {
    const enc = encryptSecret('refresh-token-value', secret);
    expect(enc).not.toContain('refresh-token-value');
    expect(decryptSecret(enc, secret)).toBe('refresh-token-value');
  });
  it('fails with another secret or tampered data', () => {
    const enc = encryptSecret('value', secret);
    expect(() => decryptSecret(enc, 'y'.repeat(48))).toThrow();
    const parts = enc.split(':');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptSecret(parts.join(':'), secret)).toThrow();
  });
});

describe('escapeHtml', () => {
  it('neutralises markup in user input', () => {
    expect(escapeHtml('<script>alert("x")</script> & \'q\'')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;',
    );
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('service slugs', () => {
  it('maps legacy identifiers to canonical slugs', () => {
    expect(normalizeServiceSlug('recording')).toBe('starter');
    expect(normalizeServiceSlug('release')).toBe('pro');
    expect(normalizeServiceSlug('editing')).toBe('pro');
    expect(normalizeServiceSlug('full')).toBe('premium');
    expect(normalizeServiceSlug(' Premium ')).toBe('premium');
    expect(normalizeServiceSlug('vip')).toBeNull();
    expect(normalizeServiceSlug(42)).toBeNull();
  });
});
