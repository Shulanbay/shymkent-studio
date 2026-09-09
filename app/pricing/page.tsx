import Link from 'next/link';

export const metadata = {
  title: 'Цены на запись подкастов | SHYM STUDIO',
  description: 'Тарифы на запись и монтаж подкастов в Шымкенте. От 15 000 ₸/час или полный пакет за 30 000 ₸.',
};

export default function PricingPage() {
  return (
    <div className="pt-20">
      <section className="py-16 md:py-32 bg-bg-light">
        <div className="container-max">
          <h1 className="mb-4">Прозрачные цены</h1>
          <p className="text-xl text-text-secondary mb-12">
            Никаких скрытых платежей. Плата полностью перед съёмкой.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="card p-8">
              <h3 className="text-2xl font-bold mb-2 text-text-primary">Запись без монтажа</h3>
              <p className="text-4xl font-bold text-orange-accent mb-2">15 000 ₸</p>
              <p className="text-text-secondary mb-6">за один час</p>

              <ul className="space-y-3 mb-8 text-text-secondary">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Съёмка на 3 камеры Sony FX30</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>До 4 микрофонов Shure SM7B</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Исходники в течение 24 часов</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Доступны 60, 90 и 120 минут</span>
                </li>
              </ul>

              <Link href="/book" className="btn-secondary text-center block">
                Выбрать
              </Link>
            </div>

            <div className="card p-8">
              <h3 className="text-2xl font-bold mb-2 text-text-primary">Монтаж эпизода</h3>
              <p className="text-4xl font-bold text-orange-accent mb-2">20 000 ₸</p>
              <p className="text-text-secondary mb-6">за один эпизод</p>

              <ul className="space-y-3 mb-8 text-text-secondary">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Монтаж до 90 минут</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>2 правки бесплатно</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Готовность за 3 рабочих дня</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Дополнительные правки платные</span>
                </li>
              </ul>

              <Link href="/book" className="btn-secondary text-center block">
                Выбрать
              </Link>
            </div>

            <div className="card p-8 border-orange-accent border-2 md:scale-105">
              <div className="inline-block mb-4 px-3 py-1 bg-orange-accent text-white rounded-full text-xs font-semibold">
                Популярно
              </div>

              <h3 className="text-2xl font-bold mb-2 text-text-primary">Полный подкаст</h3>
              <p className="text-4xl font-bold text-orange-accent mb-2">30 000 ₸</p>
              <p className="text-text-secondary mb-6">Съёмка + монтаж</p>

              <ul className="space-y-3 mb-8 text-text-secondary">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>До 90 минут съёмки</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Полный монтаж эпизода</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>2 правки бесплатно</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Готовность за 3 рабочих дня</span>
                </li>
              </ul>

              <Link href="/book" className="btn-primary text-center block">
                Забронировать
              </Link>
            </div>
          </div>

          <div className="bg-bg-card rounded-lg p-8 border border-border-light">
            <h2 className="text-2xl font-bold mb-4 text-text-primary">Условия оплаты и отмены</h2>
            <div className="space-y-4 text-text-secondary">
              <div>
                <h3 className="font-semibold text-text-primary mb-2">Оплата</h3>
                <p>100% предоплата требуется перед съёмкой через Kaspi. Бронирование не зарезервировано до оплаты.</p>
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-2">Отмена и перенос</h3>
                <p>
                  <strong>До 24 часов до съёмки:</strong> можно отменить с полным возвратом или перенести на другую дату.
                </p>
                <p className="mt-2">
                  <strong>Менее 24 часов:</strong> отмена невозможна (возврата нет). Перенос возможен только по уважительным причинам.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-2">Дополнительные правки</h3>
                <p>В пакет входит 2 правки монтажа. Каждая дополнительная правка оплачивается отдельно.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
