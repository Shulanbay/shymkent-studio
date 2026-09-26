'use client';

import { useLanguage } from '@/components/LanguageContext';

const STEPS = [1, 2, 3, 4] as const;

export function ProcessSection() {
  const { t } = useLanguage();
  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-white scroll-mt-32" aria-labelledby="process-title">
      <div className="container-max">
        <div className="text-center mb-12 md:mb-16">
          <h2 id="process-title" className="mb-4 text-text-primary">
            {t('process.title')}
          </h2>
          <p className="text-lg text-text-secondary">{t('process.subtitle')}</p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step) => (
            <li key={step} className="bg-bg-light rounded-2xl p-6 md:p-8 h-full border border-border-light">
              <p className="text-5xl font-bold text-orange-accent mb-6" aria-hidden="true">
                {String(step).padStart(2, '0')}
              </p>
              <h3 className="text-lg font-bold text-text-primary mb-3">{t(`process.step${step}Title`)}</h3>
              <p className="text-text-secondary">{t(`process.step${step}Desc`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
