'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

const pricingOptions = [
  {
    name: 'Starter',
    subtitle: 'Только запись',
    price: '20 000',
    description: 'Профессиональная запись подкаста',
    duration: '60 минут',
    features: [
      'До 3 камер Sony FX30',
      'До 4 микрофонов Shure SM7B',
      'Профессиональный свет',
      'Запись звука в высоком качестве',
      'Техническое сопровождение',
      'Передача исходных материалов',
    ],
    addOn: 'Дополнительные 30 минут: +10 000 ₸',
    highlighted: false,
  },
  {
    name: 'Pro',
    subtitle: 'Запись + монтаж',
    price: '40 000',
    description: 'Готовый эпизод для публикации',
    duration: 'До 90 минут + полный монтаж',
    badge: 'Выбирают чаще всего',
    features: [
      'До 90 минут студийного времени',
      'До 3 камер Sony FX30',
      'До 4 Shure SM7B микрофонов',
      'Профессиональный свет',
      'Запись и multicam монтаж',
      'Обработка звука и цветокоррекция',
      'Intro/outro клиента',
      'Базовая графика и имя гостя',
      'До 2 раундов небольших правок',
      'Готовый файл для публикации',
    ],
    highlighted: true,
  },
  {
    name: 'Premium',
    subtitle: 'Запись + монтаж + Reels',
    price: '60 000',
    description: 'Контент для всех социальных сетей',
    duration: '90 минут + контент для соцсетей',
    features: [
      'Всё из пакета Pro плюс:',
      '3 вертикальных Reels / Shorts',
      '1 YouTube thumbnail профессионального уровня',
      'Подготовка полного выпуска для YouTube',
      'Вертикальные ролики 9:16 для Instagram / TikTok / Shorts',
      'Базовая графика и оформление',
      'До 2 раундов небольших правок',
    ],
    tagline: 'Записали один раз — получили контент для всех площадок',
    highlighted: false,
  },
];

export function PricingSection() {
  const { language } = useLanguage();

  return (
    <section id="pricing" className="py-20 md:py-32 bg-gray-900">
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
              {option.badge && (
                <div className="absolute top-0 right-0 left-0 bg-orange-accent text-white text-xs font-bold py-2 px-4 text-center">
                  {option.badge}
                </div>
              )}

              <div className={`p-8 pt-${option.badge ? '16' : '8'} flex flex-col h-full`}>
                {/* Title and price */}
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-text-primary mb-1">{option.name}</h3>
                  {option.subtitle && <p className="text-orange-accent text-sm font-semibold mb-4">{option.subtitle}</p>}
                  <p className="text-text-secondary text-sm mb-6">{option.description}</p>

                  <div className="mb-2">
                    <span className="text-5xl font-bold text-orange-accent">{option.price}</span>
                    <span className="text-text-secondary ml-2 text-sm">₸</span>
                  </div>
                  <p className="text-xs text-text-secondary">{option.duration}</p>
                </div>

                {/* Tagline for Контент package */}
                {option.tagline && (
                  <p className="text-sm italic text-text-secondary mb-8 pb-8 border-b border-border-light">
                    &ldquo;{option.tagline}&rdquo;
                  </p>
                )}

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-grow">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-text-secondary text-sm">
                      <svg className="w-4 h-4 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Add-on info for Запись package */}
                {option.addOn && (
                  <p className="text-xs text-text-secondary mb-6 pb-6 border-t border-border-light pt-6">
                    {option.addOn}
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
          <h3 className="text-2xl font-bold text-text-primary mb-2">Записываетесь регулярно?</h3>
          <p className="text-text-secondary mb-8">
            Абонементы для блогеров, экспертов и регулярных шоу
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 border border-border-light">
              <h4 className="font-bold text-lg text-text-primary mb-4">Базовый</h4>
              <p className="text-3xl font-bold text-orange-accent mb-6">140 000 ₸<span className="text-sm text-text-secondary ml-2">/ месяц</span></p>
              <ul className="space-y-2 text-sm text-text-secondary mb-6">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  4 записи в месяц по 90 минут
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Монтаж 4 полных выпусков
                </li>
              </ul>
              <Link href="/book" className="btn-secondary w-full text-center">
                Выбрать
              </Link>
            </div>

            <div className="bg-white rounded-xl p-8 border border-orange-accent border-2 ring-2 ring-orange-accent/20">
              <div className="inline-block mb-4 px-3 py-1 bg-orange-accent text-white rounded-full text-xs font-bold">
                Рекомендуется
              </div>
              <h4 className="font-bold text-lg text-text-primary mb-4">Премиум</h4>
              <p className="text-3xl font-bold text-orange-accent mb-6">200 000 ₸<span className="text-sm text-text-secondary ml-2">/ месяц</span></p>
              <ul className="space-y-2 text-sm text-text-secondary mb-6">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  4 записи по 90 минут
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Монтаж 4 выпусков
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  12 Reels / Shorts
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  4 YouTube thumbnails
                </li>
              </ul>
              <Link href="/book" className="btn-primary w-full text-center">
                Выбрать
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
