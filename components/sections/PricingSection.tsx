'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

const getPricingOptions = () => [
  {
    name: 'Starter',
    subtitleKey: 'pricingPlan.starterSubtitle',
    price: '20 000',
    descriptionKey: 'pricingPlan.starterDesc',
    durationKey: 'pricingPlan.starterDuration',
    featureKeys: [
      'pricingPlan.starterFeature1',
      'pricingPlan.starterFeature2',
      'pricingPlan.starterFeature3',
      'pricingPlan.starterFeature4',
      'pricingPlan.starterFeature5',
      'pricingPlan.starterFeature6',
    ],
    addOnKey: 'pricingPlan.starterAddOn',
    highlighted: false,
  },
  {
    name: 'Pro',
    subtitleKey: 'pricingPlan.proSubtitle',
    price: '40 000',
    descriptionKey: 'pricingPlan.proDesc',
    durationKey: 'pricingPlan.proDuration',
    badgeKey: 'pricingPlan.proBadge',
    featureKeys: [
      'pricingPlan.proFeature1',
      'pricingPlan.proFeature2',
      'pricingPlan.proFeature3',
      'pricingPlan.proFeature4',
      'pricingPlan.proFeature5',
      'pricingPlan.proFeature6',
      'pricingPlan.proFeature7',
      'pricingPlan.proFeature8',
      'pricingPlan.proFeature9',
      'pricingPlan.proFeature10',
    ],
    highlighted: true,
  },
  {
    name: 'Premium',
    subtitleKey: 'pricingPlan.premiumSubtitle',
    price: '60 000',
    descriptionKey: 'pricingPlan.premiumDesc',
    durationKey: 'pricingPlan.premiumDuration',
    featureKeys: [
      'pricingPlan.premiumFeature1',
      'pricingPlan.premiumFeature2',
      'pricingPlan.premiumFeature3',
      'pricingPlan.premiumFeature4',
      'pricingPlan.premiumFeature5',
      'pricingPlan.premiumFeature6',
      'pricingPlan.premiumFeature7',
    ],
    taglineKey: 'pricingPlan.premiumTagline',
    highlighted: false,
  },
];

export function PricingSection() {
  const { language } = useLanguage();
  const pricingOptions = getPricingOptions();

  return (
    <section id="pricing" className="py-20 md:py-32 bg-white">
      <div className="container-max">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">{getTranslation(language, 'pricing.title')}</h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            {getTranslation(language, 'pricing.subtitle')}
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {pricingOptions.map((option) => (
            <div
              key={option.name}
              className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                option.highlighted
                  ? 'md:scale-105 ring-2 ring-orange-accent shadow-xl'
                  : 'bg-bg-light border border-border-light shadow-sm'
              } ${!option.highlighted ? 'bg-bg-light' : 'bg-white'}`}
            >
              {/* Badge for highlighted card */}
              {option.badgeKey && (
                <div className="absolute top-0 right-0 left-0 bg-orange-accent text-white text-xs font-bold py-2 px-4 text-center">
                  {getTranslation(language, option.badgeKey)}
                </div>
              )}

              <div className={`p-8 pt-${option.badgeKey ? '16' : '8'} flex flex-col h-full`}>
                {/* Title and price */}
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-text-primary mb-1">{option.name}</h3>
                  {option.subtitleKey && <p className="text-orange-accent text-sm font-semibold mb-4">{getTranslation(language, option.subtitleKey)}</p>}
                  <p className="text-text-secondary text-sm mb-6">{getTranslation(language, option.descriptionKey)}</p>

                  <div className="mb-2">
                    <span className="text-5xl font-bold text-orange-accent">{option.price}</span>
                    <span className="text-text-secondary ml-2 text-sm">₸</span>
                  </div>
                  <p className="text-xs text-text-secondary">{getTranslation(language, option.durationKey)}</p>
                </div>

                {/* Tagline for Контент package */}
                {option.taglineKey && (
                  <p className="text-sm italic text-text-secondary mb-8 pb-8 border-b border-border-light">
                    &ldquo;{getTranslation(language, option.taglineKey)}&rdquo;
                  </p>
                )}

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-grow">
                  {option.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-3 text-text-secondary text-sm">
                      <svg className="w-4 h-4 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>{getTranslation(language, featureKey)}</span>
                    </li>
                  ))}
                </ul>

                {/* Add-on info for Запись package */}
                {option.addOnKey && (
                  <p className="text-xs text-text-secondary mb-6 pb-6 border-t border-border-light pt-6">
                    {getTranslation(language, option.addOnKey)}
                  </p>
                )}

                {/* CTA Button */}
                <Link
                  href="/book"
                  className={`text-center py-3 px-6 rounded-lg font-semibold transition ${
                    option.highlighted ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {getTranslation(language, 'pricing.book')}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Subscriptions section */}
        <div className="bg-bg-light rounded-2xl p-12 border border-border-light">
          <h3 className="text-2xl font-bold text-text-primary mb-2">{getTranslation(language, 'subscription.title')}</h3>
          <p className="text-text-secondary mb-8">
            {getTranslation(language, 'subscription.subtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 border border-border-light">
              <h4 className="font-bold text-lg text-text-primary mb-4">{getTranslation(language, 'subscription.basicTitle')}</h4>
              <p className="text-3xl font-bold text-orange-accent mb-6">{getTranslation(language, 'subscription.basicPrice')}<span className="text-sm text-text-secondary ml-2">{getTranslation(language, 'subscription.basicPriceText')}</span></p>
              <ul className="space-y-2 text-sm text-text-secondary mb-6">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {getTranslation(language, 'subscription.basicFeature1')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {getTranslation(language, 'subscription.basicFeature2')}
                </li>
              </ul>
              <Link href="/book" className="btn-secondary w-full text-center">
                {getTranslation(language, 'subscription.basicButton')}
              </Link>
            </div>

            <div className="bg-white rounded-xl p-8 border border-orange-accent border-2 ring-2 ring-orange-accent/20">
              <div className="inline-block mb-4 px-3 py-1 bg-orange-accent text-white rounded-full text-xs font-bold">
                {getTranslation(language, 'subscription.recommended')}
              </div>
              <h4 className="font-bold text-lg text-text-primary mb-4">{getTranslation(language, 'subscription.premiumTitle')}</h4>
              <p className="text-3xl font-bold text-orange-accent mb-6">{getTranslation(language, 'subscription.premiumPrice')}<span className="text-sm text-text-secondary ml-2">{getTranslation(language, 'subscription.premiumPriceText')}</span></p>
              <ul className="space-y-2 text-sm text-text-secondary mb-6">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {getTranslation(language, 'subscription.premiumFeature1')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {getTranslation(language, 'subscription.premiumFeature2')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {getTranslation(language, 'subscription.premiumFeature3')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {getTranslation(language, 'subscription.premiumFeature4')}
                </li>
              </ul>
              <Link href="/book" className="btn-primary w-full text-center">
                {getTranslation(language, 'subscription.premiumButton')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
