// Public, indexable pages. The CRM (/admin) and APIs are never listed.
export const PUBLIC_PATHS = ['/', '/rooms', '/rooms/large', '/rooms/small', '/rooms/lounge', '/pricing', '/book', '/studio-tour', '/contacts', '/terms', '/privacy'] as const;

export function publicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
