export const metadata = {
  title: 'Политика конфиденциальности | SHYMKENT STUDIO',
  description: 'Политика конфиденциальности SHYMKENT STUDIO',
};

export default function PrivacyPage() {
  return (
    <div className="pt-20">
      <section className="py-16 md:py-32 bg-bg-light">
        <div className="container-max max-w-3xl">
          <h1 className="mb-8">Политика конфиденциальности</h1>

          <div className="prose prose-sm max-w-none text-text-secondary space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">Введение</h2>
              <p>
                SHYMKENT STUDIO («мы», «наш», «компания») уважает конфиденциальность наших пользователей и обязуется защищать личные данные, которые вы нам предоставляете.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">Сбор информации</h2>
              <p>Мы собираем следующую информацию при бронировании:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Ваше имя и контактные данные</li>
                <li>Номер телефона и/или адрес электронной почты</li>
                <li>Информацию о выбранной услуге и дате бронирования</li>
                <li>Любые дополнительные комментарии или запросы</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">Использование информации</h2>
              <p>Мы используем собранную информацию для:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Обработки и подтверждения вашего бронирования</li>
                <li>Отправки уведомлений о статусе вашего заказа</li>
                <li>Связи с вами по поводу вашего бронирования</li>
                <li>Улучшения наших услуг</li>
                <li>Соблюдения применимого законодательства</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">Защита данных</h2>
              <p>
                Мы применяем разумные меры безопасности для защиты ваших личных данных от несанкционированного доступа, изменения, раскрытия или уничтожения. Однако ни один метод передачи через Интернет не является полностью безопасным.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">Раскрытие информации</h2>
              <p>
                Мы не продаём, не обмениваем и не передаём ваши личные данные третьим лицам без вашего согласия, за исключением случаев, необходимых для обработки платежей и соблюдения закона.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">Права пользователя</h2>
              <p>
                Вы имеете право получить доступ, исправить или удалить ваши личные данные. Если вы хотите воспользоваться этими правами, пожалуйста, свяжитесь с нами по адресу salem@shymkent.studio.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">Изменения политики</h2>
              <p>
                Мы оставляем за собой право изменять эту политику конфиденциальности в любое время. Об изменениях будет объявлено на этой странице.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-4">Контакты</h2>
              <p>
                Если у вас есть вопросы о нашей политике конфиденциальности, пожалуйста, свяжитесь с нами:
              </p>
              <p className="mt-2">
                <a href="mailto:salem@shymkent.studio" className="text-orange-accent hover:underline">
                  salem@shymkent.studio
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
