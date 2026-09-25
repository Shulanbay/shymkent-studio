import type { MetadataRoute } from 'next';
import { publicSiteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/admin/', '/api/'] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
