export const metadata = {
  title: 'Условия бронирования | SHYM STUDIO',
  description: 'Условия бронирования и оплаты услуг SHYM STUDIO',
};

export default function TermsPage() {
  return (
    <div className="pt-20">
      <section className="py-16 md:py-32 bg-bg-light">
        <div className="container-max max-w-3xl">
          <h1 className="mb-8">Условия бронирования и оплаты</h1>

          <div className="prose prose-sm max-w-none text-text-secondary space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">1. Бронирование</h2>
              <p>
                Бронирование услуг SHYM STUDIO осуществляется через веб-сайт путём заполнения формы бронирования. Бронирование становится активным только после полной оплаты.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">2. Оплата</h2>
              <div className="space-y-3">
                <p>
                  <strong>Требуемая оплата:</strong> 100% предоплата перед съёмкой.
                </p>
                <p>
                  <strong>Способы оплаты:</strong> Мы принимаем платежи через Kaspi.
                </p>
                <p>
                  <strong>Период для оплаты:</strong> Оплата должна быть произведена в течение 48 часов после бронирования, иначе бронирование может быть отменено.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">3. Отмена и возврат</h2>
              <div className="space-y-3">
                <p>
                  <strong>До 24 часов до съёмки:</strong> Вы можете отменить бронирование с полным возвратом средств.
                </p>
                <p>
                  <strong>Менее чем за 24 часа:</strong> Отмена бронирования невозможна, и возврат средств не предусмотрен.
                </p>
                <p>
                  Исключение составляют чрезвычайные обстоятельства, которые должны быть подтверждены.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">4. Перенос даты</h2>
              <div className="space-y-3">
                <p>
                  <strong>До 24 часов до съёмки:</strong> Вы можете перенести дату съёмки на другой доступный день и время.
                </p>
                <p>
                  <strong>Менее чем за 24 часа:</strong> Перенос возможен только по уважительным причинам (подтверждённые чрезвычайные обстоятельства) и требует согласования с командой студии.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">5. Правила поведения в студии</h2>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Уважайте расписание и приезжайте вовремя</li>
                <li>Соблюдайте инструкции команды студии по использованию оборудования</li>
                <li>Не повреждайте имущество студии</li>
                <li>Разрешается приносить свои напитки и закуски</li>
                <li>Команда студии может отказать в обслуживании в случае нарушения правил</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">6. Исходники и готовые материалы</h2>
              <div className="space-y-3">
                <p>
                  <strong>Для услуги «Запись без монтажа»:</strong> Исходники всех камер и аудиодорожек передаются в течение 24 часов после съёмки через облачное хранилище.
                </p>
                <p>
                  <strong>Для услуги «Монтаж» и «Полный подкаст»:</strong> Готовый эпизод передаётся через 3 рабочих дня (понедельник–пятница). Выходные и праздники не считаются.
                </p>
                <p>
                  <strong>Правки:</strong> В пакет входит 2 правки монтажа. Каждая дополнительная правка оплачивается отдельно.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">7. Авторские права</h2>
              <p>
                Вы являетесь владельцем прав на записанный контент. SHYM STUDIO не может использовать записи для маркетинга без вашего письменного согласия.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">8. Ограничение ответственности</h2>
              <p>
                SHYM STUDIO не несёт ответственность за потерю данных из-за сбоев технического оборудования, если это произойдёт не по вине студии. Мы делаем резервные копии всех записей, но рекомендуем также сохранять копии самостоятельно.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">9. Изменения условий</h2>
              <p>
                SHYM STUDIO оставляет за собой право изменять эти условия в любое время. Об изменениях будет объявлено на веб-сайте.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">10. Контакты</h2>
              <p>
                Если у вас есть вопросы или претензии, пожалуйста, свяжитесь с нами:
              </p>
              <p className="mt-2">
                <a href="mailto:salem@shymkent.studio" className="text-orange-accent hover:underline">
                  salem@shymkent.studio
                </a>
              </p>
              <p>
                <a href="tel:+77005030501" className="text-orange-accent hover:underline">
                  +7 700 503 05 01
                </a>
              </p>
            </div>

            <p className="text-sm text-text-secondary border-t border-border-light pt-6 mt-8">
              Последнее обновление: сентябрь 2026
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
