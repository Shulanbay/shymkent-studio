'use client';

import { useLanguage } from '@/components/LanguageContext';

const STATS = [
  { number: '3×', labelKey: 'trust.sony' },
  { number: '4×', labelKey: 'trust.shure' },
  { number: '3', labelKey: 'trust.studios' },
  { number: '4K', labelKey: 'trust.video' },
  { number: '✓', labelKey: 'trust.light' },
  { number: '✓', labelKey: 'trust.production' },
];

export function EquipmentSection() {
  const { t } = useLanguage();
  return (
    <section className="py-20 md:py-32 bg-white" aria-labelledby="equipment-title">
      <div className="container-max">
        <h2 id="equipment-title" className="text-center mb-12 md:mb-16 text-text-primary">
          {t('trust.title')}
        </h2>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
          {STATS.map((stat) => (
            <li key={stat.labelKey} className="text-center">
              <p className="text-5xl md:text-6xl font-bold text-brand-strong mb-3" aria-hidden="true">
                {stat.number}
              </p>
              <p className="text-text-secondary font-medium">
                <span className="sr-only">{stat.number !== '✓' ? `${stat.number} ` : ''}</span>
                {t(stat.labelKey)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
