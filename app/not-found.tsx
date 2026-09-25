import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/site/NotFoundContent';
import { SiteShell } from '@/components/site/SiteShell';

export const metadata: Metadata = {
  title: 'Страница не найдена | SHYMKENT STUDIO',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <SiteShell structuredData={false}>
      <NotFoundContent />
    </SiteShell>
  );
}
