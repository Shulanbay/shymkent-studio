'use client';

import { useState } from 'react';

const faqItems = [
  {
    question: 'Сколько стоит запись подкаста?',
    answer: 'Запись начинается с 15 000 ₸/час. Полный пакет со съёмкой и монтажом одного эпизода стоит 30 000 ₸.',
  },
  {
    question: 'Что входит в полный пакет за 30 000 ₸?',
    answer: 'До 90 минут съёмки на 3 камеры, до 4 микрофонов, полный монтаж одного эпизода, 2 правки монтажа бесплатно. Готовность через 3 рабочих дня.',
  },
  {
    question: 'Можно ли заказать только съёмку?',
    answer: 'Да, услуга "Запись без монтажа" стоит 15 000 ₸/час. Вы получите исходники всех камер и аудио в течение 24 часов.',
  },
  {
    question: 'Сколько человек может участвовать в записи?',
    answer: 'Это зависит от выбранной комнаты: Большая подкаст-зона вмещает 4 человека, Маленькая комната — 2 человека, Living Room — 3 человека.',
  },
  {
    question: 'Когда будут готовы материалы?',
    answer: 'Исходники передаются в течение 24 часов. Монтаж готовится за 3 рабочих дня (пн-пт). Выходные и праздники не считаются.',
  },
  {
    question: 'Можно ли оплатить через Kaspi?',
    answer: 'Да, мы принимаем оплату через Kaspi. Ссылка для оплаты отправляется после бронирования.',
  },
  {
    question: 'Как перенести или отменить запись?',
    answer: 'До 24 часов до съёмки можно отменить запись с возвратом средств или перенести на другую дату. Менее чем за 24 часа отмена невозможна. Перенос возможен по уважительным причинам на другую дату.',
  },
  {
    question: 'Можно ли посмотреть студию до бронирования?',
    answer: 'Конечно! Запишитесь на бесплатный тур, и мы покажем все три комнаты, оборудование и обсудим ваш проект.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 md:py-32 bg-bg-card">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">Часто задаваемые вопросы</h2>
          <p className="text-xl text-text-secondary">Ответы на популярные вопросы</p>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {faqItems.map((item, index) => (
            <div key={index} className="border border-border-light rounded-card overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 md:px-8 md:py-6 text-left font-semibold text-text-primary hover:bg-bg-light transition flex items-center justify-between"
              >
                <span>{item.question}</span>
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
                <div className="px-6 py-4 md:px-8 md:py-6 bg-bg-light border-t border-border-light text-text-secondary">
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
