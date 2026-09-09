'use client';

import Link from 'next/link';

const pricingOptions = [
  {
    name: 'Запись без монтажа',
    price: '15 000',
    period: '/ час',
    description: 'Съёмка на 3 камеры, до 4 микрофонов',
    features: [
      'Съёмка на 3 камеры Sony FX30',
      'До 4 микрофонов Shure SM7B',
      'Передача исходников в течение 24 часов',
      'Доступны 60, 90 и 120 минут',
    ],
    highlighted: false,
  },
  {
    name: 'Монтаж эпизода',
    price: '20 000',
    period: '/ эпизод',
    description: 'Профессиональный монтаж со звуком',
    features: [
      'Монтаж одного эпизода (до 90 мин)',
      '2 правки монтажа бесплатно',
      'Готовность через 3 рабочих дня',
      'Работаем пн-пт (сб-вс отдых)',
    ],
    highlighted: false,
  },
  {
    name: 'Полный подкаст',
    price: '30 000',
    period: '/ эпизод',
    description: 'Съёмка + профессиональный монтаж',
    features: [
      'До 90 минут съёмки на 3 камеры',
      'До 4 микрофонов Shure SM7B',
      'Полный монтаж одного эпизода',
      '2 правки монтажа бесплатно',
      'Готовность через 3 рабочих дня',
    ],
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section className="py-16 md:py-32 bg-bg-card">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">Стоимость записи</h2>
          <p className="text-xl text-text-secondary">Выберите подходящий пакет или комбинируйте услуги</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {pricingOptions.map((option) => (
            <div
              key={option.name}
              className={`card p-8 flex flex-col h-full transition-all ${
                option.highlighted
                  ? 'md:scale-105 border-orange-accent border-2 shadow-lg'
                  : 'border border-border-light'
              }`}
            >
              {option.highlighted && (
                <div className="inline-block mb-4 px-3 py-1 bg-orange-accent text-white rounded-full text-xs font-semibold w-fit">
                  Съёмка + монтаж
                </div>
              )}

              <h3 className="text-2xl font-bold mb-2 text-text-primary">{option.name}</h3>

              <div className="mb-4">
                <span className="text-5xl font-bold text-orange-accent">{option.price}</span>
                <span className="text-text-secondary ml-2">{option.period}</span>
              </div>

              <p className="text-text-secondary mb-8 flex-grow">{option.description}</p>

              <ul className="space-y-3 mb-8">
                {option.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-text-secondary">
                    <svg className="w-5 h-5 text-orange-accent mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/book" className={`text-center py-3 px-6 rounded-card font-semibold transition ${
                option.highlighted
                  ? 'btn-primary'
                  : 'btn-secondary'
              }`}>
                Выбрать
              </Link>
            </div>
          ))}
        </div>

        <div className="bg-bg-light rounded-lg p-8 border border-border-light">
          <h3 className="font-bold text-lg mb-4 text-text-primary">Экономия с полным пакетом</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="text-text-secondary mb-2">При заказе отдельно:</p>
              <p className="text-2xl font-bold text-text-primary">
                <span className="line-through text-text-secondary">42 500 ₸</span>
              </p>
              <p className="text-sm text-text-secondary mt-2">
                Запись 60 мин (15 000 ₸) × 1.5 = 22 500 ₸<br />
                + Монтаж эпизода = 20 000 ₸
              </p>
            </div>
            <div>
              <p className="text-text-secondary mb-2">Полный пакет до 90 минут:</p>
              <p className="text-2xl font-bold text-orange-accent">30 000 ₸</p>
              <p className="text-sm text-orange-accent mt-2">
                ✓ Экономия: 12 500 ₸
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
