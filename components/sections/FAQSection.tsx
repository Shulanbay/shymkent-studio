'use client';

import { useState } from 'react';

const faqItems = [
  {
    question: 'Какой пакет выбрать?',
    answer: 'Выбор зависит от ваших потребностей. Пакет "Запись" (20 000 ₸) включает только съёмку, подходит если вы будете монтировать сами. Пакет "Выпуск" (40 000 ₸) — самый популярный, включает съёмку и полный монтаж. Пакет "Контент" (60 000 ₸) добавляет вертикальные видео и постеры для соцсетей.',
  },
  {
    question: 'Что входит в пакет "Выпуск"?',
    answer: 'До 90 минут студийного времени, съёмка на 3 камеры Sony FX30, до 4 микрофонов, профессиональный свет, запись, multicam монтаж, обработка звука, базовая цветокоррекция, intro/outro, базовая графика, до 2 раундов правок и готовый файл для публикации.',
  },
  {
    question: 'Можно ли заказать только съёмку?',
    answer: 'Да! Пакет "Запись" (20 000 ₸) за 60 минут включает все оборудование и техническое сопровождение. Вы получите исходники всех камер и аудио в течение 24 часов. Дополнительные 30 минут стоят 10 000 ₸.',
  },
  {
    question: 'Сколько человек может участвовать?',
    answer: 'Большая студия вмещает 4 человека, маленькая комната — 2 человека, Living Room — 3 человека. Количество микрофонов и камер зависит от числа участников и выбранного пакета.',
  },
  {
    question: 'Когда будут готовы материалы?',
    answer: 'Исходники для пакета "Запись" готовы через 24 часа. Для пакетов "Выпуск" и "Контент" с монтажом готовность через 3-5 рабочих дней (пн-пт). Срочный монтаж за 24 часа доступен за дополнительную плату.',
  },
  {
    question: 'Какие способы оплаты?',
    answer: 'Мы принимаем Kaspi, переводы на счёт, наличные при съёмке. Ссылка для оплаты отправляется после подтверждения бронирования.',
  },
  {
    question: 'Как отменить или перенести съёмку?',
    answer: 'До 48 часов до съёмки можно отменить с полным возвратом средств или перенести на другую дату. От 48 до 24 часов — возврат 80%. Менее чем за 24 часа возврат невозможен.',
  },
  {
    question: 'Можно ли посмотреть студию?',
    answer: 'Конечно! Запишитесь на бесплатный тур, и мы покажем все три студии, оборудование, обсудим вашу идею и ответим на вопросы.',
  },
  {
    question: 'Есть ли скидки для постоянных клиентов?',
    answer: 'Да, у нас есть абонементы для регулярных записей. Базовый абонемент (140 000 ₸/месяц) включает 4 записи и монтаж. Премиум абонемент (200 000 ₸/месяц) добавляет контент для соцсетей.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">Часто задаваемые вопросы</h2>
          <p className="text-lg text-text-secondary">Всё, что нужно знать перед бронированием</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqItems.map((item, index) => (
            <div key={index} className="border border-border-light rounded-lg overflow-hidden hover:border-orange-accent/50 transition-colors">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 md:px-8 md:py-5 text-left font-semibold text-text-primary hover:bg-bg-light transition flex items-center justify-between"
              >
                <span className="pr-4">{item.question}</span>
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
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
