import Link from 'next/link';

export const metadata = {
  title: 'Цены на запись подкастов | SHYMKENT STUDIO',
  description: 'Тарифы на запись и монтаж подкастов в Шымкенте. Запись от 20 000 ₸. Готовый эпизод от 40 000 ₸. Контент для всех соцсетей от 60 000 ₸.',
};

export default function PricingPage() {
  const pricingOptions = [
    {
      name: 'Запись',
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
      name: 'Выпуск',
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
      name: 'Контент',
      price: '60 000',
      description: 'Контент для всех социальных сетей',
      duration: '90 минут + контент для соцсетей',
      features: [
        'Всё из пакета «Выпуск» плюс:',
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

  return (
    <div className="pt-20 min-h-screen">
      <section className="py-20 md:py-32 bg-white">
        <div className="container-max">
          <div className="text-center mb-16">
            <h1 className="mb-4">Прозрачные цены</h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Все пакеты включают профессиональное оборудование, опытный персонал и высочайшее качество звука. Никаких скрытых платежей.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {pricingOptions.map((option) => (
              <div
                key={option.name}
                className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                  option.highlighted
                    ? 'md:scale-105 ring-2 ring-orange-accent shadow-xl bg-white'
                    : 'bg-bg-light border border-border-light shadow-sm'
                }`}
              >
                {option.badge && (
                  <div className="absolute top-0 right-0 left-0 bg-orange-accent text-white text-xs font-bold py-2 px-4 text-center">
                    {option.badge}
                  </div>
                )}

                <div className={`p-8 pt-${option.badge ? '16' : '8'} flex flex-col h-full`}>
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-text-primary mb-2">{option.name}</h3>
                    <p className="text-text-secondary text-sm mb-6">{option.description}</p>

                    <div className="mb-2">
                      <span className="text-5xl font-bold text-orange-accent">{option.price}</span>
                      <span className="text-text-secondary ml-2 text-sm">₸</span>
                    </div>
                    <p className="text-xs text-text-secondary">{option.duration}</p>
                  </div>

                  {option.tagline && (
                    <p className="text-sm italic text-text-secondary mb-8 pb-8 border-b border-border-light">
                      &ldquo;{option.tagline}&rdquo;
                    </p>
                  )}

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

                  {option.addOn && (
                    <p className="text-xs text-text-secondary mb-6 pb-6 border-t border-border-light pt-6">
                      {option.addOn}
                    </p>
                  )}

                  <Link
                    href="/book"
                    className={`text-center py-3 px-6 rounded-lg font-semibold transition ${
                      option.highlighted ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    Забронировать
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-bg-light rounded-2xl p-12 border border-border-light">
            <h2 className="text-2xl font-bold text-text-primary mb-2">Условия оплаты и отмены</h2>
            <div className="space-y-4 text-text-secondary">
              <div>
                <h3 className="font-semibold text-text-primary mb-2">Оплата</h3>
                <p>100% предоплата требуется перед съёмкой через Kaspi. Бронирование не зарезервировано до оплаты.</p>
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-2">Отмена и перенос</h3>
                <p>
                  <strong>До 48 часов до съёмки:</strong> можно отменить с полным возвратом или перенести на другую дату.
                </p>
                <p className="mt-2">
                  <strong>От 48 до 24 часов:</strong> возврат 80%.
                </p>
                <p className="mt-2">
                  <strong>Менее 24 часов:</strong> отмена невозможна (возврата нет).
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-2">Дополнительные услуги</h3>
                <p>В пакеты входят определённые правки. Дополнительные услуги и правки оплачиваются отдельно.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
