import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/site/NotFoundContent';
import { SiteShell } from '@/components/site/SiteShell';
import { NOT_FOUND_TITLE, SITE_NAME } from '@/lib/page-titles';

export const metadata: Metadata = {
  title: `${NOT_FOUND_TITLE.ru} | ${SITE_NAME}`,
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <SiteShell structuredData={false}>
      <NotFoundContent />
    </SiteShell>
  );
}
