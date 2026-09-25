import type { MetadataRoute } from 'next';
import { PUBLIC_PATHS, publicSiteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicSiteUrl();
  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path === '/' ? '' : path}`,
    changeFrequency: path === '/' || path === '/pricing' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/book' || path === '/pricing' ? 0.8 : 0.5,
  }));
}
