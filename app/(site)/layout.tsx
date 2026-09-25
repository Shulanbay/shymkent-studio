import { SiteShell } from '@/components/site/SiteShell';

// Public pages are static and re-generated periodically so that settings
// changed in the CRM (prices, contacts, policy) reach the site; CRM actions
// also revalidate them immediately.
export const revalidate = 300;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
