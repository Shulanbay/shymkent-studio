import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'CRM | SHYMKENT STUDIO', template: '%s | CRM SHYMKENT STUDIO' },
  robots: { index: false, follow: false },
};

// Every admin page depends on the signed-in user, so nothing here is cached.
export const dynamic = 'force-dynamic';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-bg-light text-text-primary">{children}</div>;
}
