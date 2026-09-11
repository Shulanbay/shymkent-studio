'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { language } = useLanguage();

  const faqItems = [
    {
      questionKey: 'faq.q1',
      answerKey: 'faq.a1',
    },
    {
      questionKey: 'faq.q2',
      answerKey: 'faq.a2',
    },
    {
      questionKey: 'faq.q3',
      answerKey: 'faq.a3',
    },
    {
      questionKey: 'faq.q4',
      answerKey: 'faq.a4',
    },
    {
      questionKey: 'faq.q5',
      answerKey: 'faq.a5',
    },
    {
      questionKey: 'faq.q6',
      answerKey: 'faq.a6',
    },
    {
      questionKey: 'faq.q7',
      answerKey: 'faq.a7',
    },
    {
      questionKey: 'faq.q8',
      answerKey: 'faq.a8',
    },
    {
      questionKey: 'faq.q1',
      answerKey: 'faq.a1',
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">{getTranslation(language, 'faq.title')}</h2>
          <p className="text-lg text-text-secondary">{getTranslation(language, 'faq.subtitle')}</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqItems.map((item, index) => (
            <div key={index} className="border border-border-light rounded-lg overflow-hidden hover:border-orange-accent/50 transition-colors">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 md:px-8 md:py-5 text-left font-semibold text-text-primary hover:bg-bg-light transition flex items-center justify-between"
              >
                <span className="pr-4">{getTranslation(language, item.questionKey)}</span>
                <svg
                  className={`w-5 h-5 text-orange-accent transition-transform flex-shrink-0 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>

              {openIndex === index && (
                <div className="px-6 py-4 md:px-8 md:py-5 bg-bg-light border-t border-border-light text-text-secondary text-sm">
                  {getTranslation(language, item.answerKey)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
