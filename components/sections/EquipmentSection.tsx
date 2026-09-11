'use client';

import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export function EquipmentSection() {
  const { language } = useLanguage();

  const getStats = () => [
    {
      number: '3×',
      labelKey: 'trust.sony',
    },
    {
      number: '4×',
      labelKey: 'trust.shure',
    },
    {
      number: '3',
      labelKey: 'trust.studios',
    },
    {
      number: '4K',
      labelKey: 'trust.video',
    },
    {
      number: '∞',
      labelKey: 'trust.light',
    },
    {
      number: '✓',
      labelKey: 'trust.production',
    },
  ];

  const stats = getStats();

  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-6 text-text-primary">{getTranslation(language, 'trust.title')}</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
          {stats.map((stat) => (
            <div key={stat.labelKey} className="text-center">
              <div className="text-5xl md:text-6xl font-bold text-orange-accent mb-3">
                {stat.number}
              </div>
              <p className="text-text-secondary font-medium">{getTranslation(language, stat.labelKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
