'use client';

import Link from 'next/link';
import { formatPrice, useCatalog } from '@/components/CatalogContext';
import { useLanguage } from '@/components/LanguageContext';

const PLANS = [
  {
    name: 'Starter',
    slug: 'starter',
    prefix: 'starter',
    features: 6,
    fallbackPrice: 20000,
    fallbackMinutes: 60,
  },
  {
    name: 'Pro',
    slug: 'pro',
    prefix: 'pro',
    features: 10,
    badge: true,
    fallbackPrice: 40000,
    fallbackMinutes: 90,
  },
  {
    name: 'Premium',
    slug: 'premium',
    prefix: 'premium',
    features: 7,
    tagline: true,
    fallbackPrice: 60000,
    fallbackMinutes: 90,
  },
] as const;

function Check() {
  return (
    <svg className="w-4 h-4 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Tariff cards. Prices and durations come from the catalog (CRM), the same data the booking form uses. */
export function PricingSection({ asPage = false }: { asPage?: boolean }) {
  const { t } = useLanguage();
  const catalog = useCatalog();
  const Title = asPage ? 'h1' : 'h2';
  const CardTitle = asPage ? 'h2' : 'h3';

  const plans = PLANS.map((plan) => {
    const service = catalog.services.find((s) => s.slug === plan.slug);
    const minutes = service?.defaultDuration ?? plan.fallbackMinutes;
    return {
      ...plan,
      available: Boolean(service),
      price: formatPrice(service?.basePrice ?? plan.fallbackPrice),
      duration: t(`pricingPlan.${plan.prefix}Duration`).replace('{n}', String(minutes)),
      addOn:
        service?.extraStepMinutes && service.extraStepPrice
          ? t('pricingPlan.starterAddOn')
              .replace('{minutes}', String(service.extraStepMinutes))
              .replace('{price}', formatPrice(service.extraStepPrice))
          : null,
    };
  }).filter((plan) => plan.available || !catalog.live);

  const subscriptionFeatures = {
    basic: ['subscription.basicFeature1', 'subscription.basicFeature2'],
    premium: ['subscription.premiumFeature1', 'subscription.premiumFeature2', 'subscription.premiumFeature3', 'subscription.premiumFeature4'],
  };
  const whatsapp = `https://wa.me/${catalog.contacts.whatsapp}`;

  return (
    <section id="pricing" className={`bg-white ${asPage ? 'pt-12 pb-16 md:pt-24 md:pb-20' : 'py-20 md:py-32'}`}>
      <div className="container-max">
        <div className="text-center mb-12 md:mb-16">
          <Title className="mb-4 text-text-primary">{asPage ? t('pricingPage.title') : t('pricing.title')}</Title>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">{asPage ? t('pricingPage.subtitle') : t('pricing.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 md:mb-20">
          {plans.map((plan) => {
            const highlighted = 'badge' in plan && plan.badge;
            return (
              <div
                key={plan.slug}
                className={`relative rounded-2xl overflow-hidden flex flex-col ${
                  highlighted ? 'md:scale-105 ring-2 ring-orange-accent shadow-xl bg-white' : 'bg-bg-light border border-border-light shadow-sm'
                }`}
              >
                {highlighted && (
                  <p className="bg-orange-accent text-white text-xs font-bold py-2 px-4 text-center">{t('pricingPlan.proBadge')}</p>
                )}
                <div className="p-6 md:p-8 flex flex-col flex-grow">
                  <div className="mb-6">
                    <CardTitle className="text-2xl font-bold text-text-primary mb-1">{plan.name}</CardTitle>
                    <p className="text-orange-accent text-sm font-semibold mb-4">{t(`pricingPlan.${plan.prefix}Subtitle`)}</p>
                    <p className="text-text-secondary text-sm mb-6">{t(`pricingPlan.${plan.prefix}Desc`)}</p>
                    <p className="mb-2">
                      <span className="text-4xl md:text-5xl font-bold text-orange-accent">{plan.price}</span>
                      <span className="text-text-secondary ml-2 text-sm">₸</span>
                    </p>
                    <p className="text-sm text-text-secondary">{plan.duration}</p>
                  </div>

                  {'tagline' in plan && plan.tagline && (
                    <p className="text-sm italic text-text-secondary mb-6 pb-6 border-b border-border-light">
                      «{t('pricingPlan.premiumTagline')}»
                    </p>
                  )}

                  <ul className="space-y-3 mb-8 flex-grow">
                    {Array.from({ length: plan.features }, (_, i) => `pricingPlan.${plan.prefix}Feature${i + 1}`).map((key) => (
                      <li key={key} className="flex items-start gap-3 text-text-secondary text-sm">
                        <Check />
                        <span>{t(key)}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.addOn && <p className="text-sm text-text-secondary mb-6 pt-6 border-t border-border-light">{plan.addOn}</p>}

                  <Link href={`/book?service=${plan.slug}`} className={`text-center ${highlighted ? 'btn-primary' : 'btn-secondary'}`}>
                    {t('pricing.book')}
                    <span className="sr-only"> — {plan.name}</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-bg-light rounded-2xl p-6 md:p-12 border border-border-light">
          <CardTitle className="text-2xl font-bold text-text-primary mb-2">{t('subscription.title')}</CardTitle>
          <p className="text-text-secondary mb-8">{t('subscription.subtitle')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {(['basic', 'premium'] as const).map((tier) => (
              <div
                key={tier}
                className={`bg-white rounded-xl p-6 md:p-8 flex flex-col ${
                  tier === 'premium' ? 'border-2 border-orange-accent' : 'border border-border-light'
                }`}
              >
                {tier === 'premium' && (
                  <p className="self-start mb-4 px-3 py-1 bg-orange-accent text-white rounded-full text-xs font-bold">{t('subscription.recommended')}</p>
                )}
                <p className="font-bold text-lg text-text-primary mb-4">{t(`subscription.${tier}Title`)}</p>
                <p className="text-3xl font-bold text-orange-accent mb-6">
                  {t(`subscription.${tier}Price`)}
                  <span className="text-sm text-text-secondary ml-2">{t(`subscription.${tier}PriceText`)}</span>
                </p>
                <ul className="space-y-2 text-sm text-text-secondary mb-6 flex-grow">
                  {subscriptionFeatures[tier].map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <Check />
                      {t(key)}
                    </li>
                  ))}
                </ul>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full text-center ${tier === 'premium' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {t(`subscription.${tier}Button`)}
                  <span className="sr-only">
                    {' '}
                    — {t(`subscription.${tier}Title`)} {t('common.opensInNewTab')}
                  </span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
