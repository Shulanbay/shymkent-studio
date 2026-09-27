import type { PublicCatalog } from '@/lib/catalog-types';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * schema.org ProfessionalService / LocalBusiness built only from real data
 * (catalog, contacts, working hours). No ratings, reviews or invented facts.
 */
export function buildStructuredData(catalog: PublicCatalog, siteUrl: string) {
  const c = catalog.contacts;
  const prices = catalog.services.map((s) => s.basePrice);
  return {
    '@context': 'https://schema.org',
    '@type': ['ProfessionalService', 'LocalBusiness'],
    name: c.studioName,
    description: 'Подкаст- и видеостудия в Шымкенте: запись подкастов, интервью и видео, монтаж, контент для соцсетей. Посещение по предварительной записи.',
    url: siteUrl,
    telephone: c.phone,
    email: c.email,
    ...(c.mapUrl ? { hasMap: c.mapUrl } : {}),
    image: `${siteUrl}/opengraph-image.jpg`,
    areaServed: { '@type': 'City', name: c.city || 'Шымкент' },
    address: {
      '@type': 'PostalAddress',
      ...(c.address ? { streetAddress: c.address } : {}),
      addressLocality: c.city,
      addressCountry: 'KZ',
    },
    ...(c.instagram ? { sameAs: [`https://instagram.com/${c.instagram}`] } : {}),
    ...(prices.length ? { priceRange: `${Math.min(...prices)}–${Math.max(...prices)} KZT` } : {}),
    currenciesAccepted: 'KZT',
    paymentAccepted: 'Kaspi, bank transfer',
    openingHoursSpecification: catalog.openingHours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${DAYS[h.day]}`,
      opens: h.opens,
      closes: h.closes,
    })),
    makesOffer: catalog.services.map((s) => ({
      '@type': 'Offer',
      name: s.nameRu,
      price: s.basePrice,
      priceCurrency: 'KZT',
      url: `${siteUrl}/book?service=${s.slug}`,
    })),
  };
}

export function StructuredData({ catalog, siteUrl }: { catalog: PublicCatalog; siteUrl: string }) {
  // "<" is escaped so user-editable text can never close the script element.
  const json = JSON.stringify(buildStructuredData(catalog, siteUrl)).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
