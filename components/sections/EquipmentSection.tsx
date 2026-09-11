'use client';

import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export function EquipmentSection() {
  const { language } = useLanguage();
  const stats = [
    {
      number: '3×',
      label: 'Sony FX30',
    },
    {
      number: '4×',
      label: 'Shure SM7B',
    },
    {
      number: '3',
      label: 'уникальные студии',
    },
    {
      number: '4K',
      label: 'Video',
    },
    {
      number: '∞',
      label: 'Профессиональный свет',
    },
    {
      number: '✓',
      label: 'Готовый multicam production',
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-6 text-text-primary">На чём вы можете быть уверены</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-5xl md:text-6xl font-bold text-orange-accent mb-3">
                {stat.number}
              </div>
              <p className="text-text-secondary font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
