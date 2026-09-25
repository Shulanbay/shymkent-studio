// Validates the post-login `next` parameter so it can only point inside the
// admin area of this site (prevents open redirects such as //evil.com).
export function safeAdminRedirect(value: unknown): string {
  if (typeof value !== 'string') return '/admin';
  if (!value.startsWith('/admin')) return '/admin';
  if (value.startsWith('//') || value.includes('\\') || /[\r\n\t]/.test(value)) return '/admin';
  if (value.startsWith('/admin/login')) return '/admin';
  // Must be exactly /admin or /admin/... or /admin?...
  if (!/^\/admin(\/|\?|$)/.test(value)) return '/admin';
  return value;
}
