import { CatalogProvider } from '@/components/CatalogContext';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { LanguageProvider } from '@/components/LanguageContext';
import { PolicyProvider } from '@/components/PolicyContext';
import { StructuredData } from '@/components/StructuredData';
import { getPublicCatalog } from '@/lib/public-catalog';
import { getPublicCancellationPolicy } from '@/lib/public-settings';
import { publicSiteUrl } from '@/lib/seo';

/** Header, footer and data providers of the public site (also used by the global 404 page). */
export async function SiteShell({ children, structuredData = true }: { children: React.ReactNode; structuredData?: boolean }) {
  const [policy, catalog] = await Promise.all([getPublicCancellationPolicy(), getPublicCatalog()]);
  return (
    <LanguageProvider>
      <PolicyProvider policy={policy}>
        <CatalogProvider catalog={catalog}>
          {structuredData && <StructuredData catalog={catalog} siteUrl={publicSiteUrl()} />}
          <Header />
          <main id="main" tabIndex={-1} className="pt-[var(--header-height)] outline-none">
            {children}
          </main>
          <Footer />
        </CatalogProvider>
      </PolicyProvider>
    </LanguageProvider>
  );
}
