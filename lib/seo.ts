import { SITE_NAME, pageTitle } from '@/lib/page-titles';

// Public, indexable pages. The CRM (/admin) and APIs are never listed.
export const PUBLIC_PATHS = ['/', '/rooms', '/rooms/large', '/rooms/small', '/rooms/lounge', '/pricing', '/book', '/studio-tour', '/contacts', '/terms', '/privacy'] as const;

export function publicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Title, description, canonical and Open Graph of a public page (title from
 * lib/page-titles.ts). A page-level `openGraph` replaces the layout one
 * entirely, so the shared fields are repeated here.
 */
export function pageMetadata(path: string, description: string, images?: { url: string }[]) {
  const title = pageTitle(path, 'ru') ?? SITE_NAME;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: 'website' as const,
      locale: 'ru_KZ',
      alternateLocale: ['kk_KZ'],
      siteName: SITE_NAME,
      ...(images ? { images } : {}),
    },
  };
}
