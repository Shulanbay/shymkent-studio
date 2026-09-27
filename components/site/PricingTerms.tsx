'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';
import { useCancellationPolicy } from '@/components/PolicyContext';
import { policyTexts } from '@/lib/policy';

/** Payment and cancellation summary under the tariffs; generated from the CRM policy. */
export function PricingTerms() {
  const { language, t } = useLanguage();
  const policy = policyTexts(useCancellationPolicy(), language);
  return (
    <section className="pb-16 md:pb-24 bg-white" aria-labelledby="pricing-terms">
      <div className="container-max">
        <div className="mb-8 md:mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-6">{t('pricingPage.flowTitle')}</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['booking.how1', 'booking.how2', 'booking.how3', 'booking.how4'] as const).map((key, i) => (
              <li key={key} className="flex gap-3 rounded-2xl border border-border-light bg-white p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-bold text-on-brand" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="text-sm text-text-secondary">{t(key)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="bg-bg-light rounded-2xl p-6 md:p-12 border border-border-light">
          <h2 id="pricing-terms" className="text-2xl md:text-3xl font-bold text-text-primary mb-6">
            {t('pricingPage.termsTitle')}
          </h2>
          <div className="space-y-6 text-text-secondary">
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{t('pricingPage.paymentTitle')}</h3>
              <p>{t('pricingPage.paymentText')}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{t('pricingPage.cancelTitle')}</h3>
              <ul className="space-y-2">
                {[policy.full, policy.partial, policy.none, policy.reschedule, policy.override].filter(Boolean).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{t('pricingPage.extrasTitle')}</h3>
              <p>{t('pricingPage.extrasText')}</p>
            </div>
            <Link href="/terms" className="inline-block text-brand-ink font-semibold hover:underline">
              {t('pricingPage.fullTerms')} →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
