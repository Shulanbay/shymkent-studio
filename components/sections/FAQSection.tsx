'use client';

import { useId, useState } from 'react';
import { formatPrice, useCatalog } from '@/components/CatalogContext';
import { useLanguage } from '@/components/LanguageContext';
import { useCancellationPolicy } from '@/components/PolicyContext';
import { policyTexts } from '@/lib/policy';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { language, t } = useLanguage();
  const policy = useCancellationPolicy();
  const catalog = useCatalog();
  const baseId = useId();

  // Prices, durations and capacities come from the catalog (CRM), so the FAQ never contradicts /pricing.
  const service = (slug: string) => catalog.services.find((s) => s.slug === slug);
  const capacity = (slug: string, fallback: number) => String(catalog.rooms.find((r) => r.slug === slug)?.capacity ?? fallback);
  const values: Record<string, string> = {
    starter: formatPrice(service('starter')?.basePrice ?? 20000),
    pro: formatPrice(service('pro')?.basePrice ?? 40000),
    premium: formatPrice(service('premium')?.basePrice ?? 60000),
    starterMinutes: String(service('starter')?.defaultDuration ?? 60),
    proMinutes: String(service('pro')?.maxDuration ?? 90),
    large: capacity('large', 4),
    small: capacity('small', 2),
    lounge: capacity('lounge', 3),
  };
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m);

  const faqItems = [
    { q: 'faq.q1', a: fill(t('faq.a1')) },
    { q: 'faq.q2', a: fill(t('faq.a2')) },
    { q: 'faq.q3', a: fill(t('faq.a3')) },
    { q: 'faq.q4', a: fill(t('faq.a4')) },
    { q: 'faq.q5', a: t('faq.a5') },
    { q: 'faq.q6', a: t('faq.a6') },
    // Generated from the cancellation policy configured in the CRM.
    { q: 'faq.q7', a: policyTexts(policy, language).summary },
    { q: 'faq.q8', a: t('faq.a8') },
  ];

  return (
    <section className="py-20 md:py-32 bg-white" aria-labelledby={`${baseId}-title`}>
      <div className="container-max">
        <div className="text-center mb-12 md:mb-16">
          <h2 id={`${baseId}-title`} className="mb-4 text-text-primary">
            {t('faq.title')}
          </h2>
          <p className="text-lg text-text-secondary">{t('faq.subtitle')}</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqItems.map((item, index) => {
            const open = openIndex === index;
            return (
              <div key={item.q} className="border border-border-light rounded-lg overflow-hidden hover:border-orange-accent/50 transition-colors">
                <h3 className="text-base">
                  <button
                    type="button"
                    id={`${baseId}-q${index}`}
                    aria-expanded={open}
                    aria-controls={`${baseId}-a${index}`}
                    onClick={() => setOpenIndex(open ? null : index)}
                    className="w-full min-h-[56px] px-5 py-4 md:px-8 md:py-5 text-left font-semibold text-text-primary hover:bg-bg-light transition flex items-center justify-between gap-4"
                  >
                    <span>{t(item.q)}</span>
                    <svg
                      className={`w-5 h-5 text-orange-accent transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </h3>
                <div
                  id={`${baseId}-a${index}`}
                  role="region"
                  aria-labelledby={`${baseId}-q${index}`}
                  hidden={!open}
                  className="px-5 py-4 md:px-8 md:py-5 bg-bg-light border-t border-border-light text-text-secondary"
                >
                  {item.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
