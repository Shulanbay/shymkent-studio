import Link from 'next/link';

export const metadata = {
  title: 'Контакты | SHYMKENT STUDIO',
  description: 'Адрес студии, телефон и контакты SHYMKENT STUDIO в Шымкенте',
};

export default function ContactsPage() {
  return (
    <div className="pt-20">
      <section className="py-16 md:py-32 bg-bg-light">
        <div className="container-max">
          <h1 className="mb-4">Контакты</h1>
          <p className="text-xl text-text-secondary mb-12">Как найти и связаться со студией</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="card p-8">
                <h3 className="font-bold text-lg mb-2 text-text-primary">📍 Адрес</h3>
                <p className="text-text-secondary mb-2">
                  Шымкент, ул. Сейдоллы Байтерекова, 85<br />
                  ЖК «Байтерек»
                </p>
                <a
                  href="https://maps.google.com/?q=Shymkent,+Seidolla+Bayterek+Street,+85"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-accent hover:underline font-semibold"
                >
                  Открыть на карте
                </a>
              </div>

              <div className="card p-8">
                <h3 className="font-bold text-lg mb-2 text-text-primary">📞 Телефон</h3>
                <a href="tel:+77005030501" className="text-2xl font-bold text-orange-accent hover:underline">
                  +7 700 503 05 01
                </a>
              </div>

              <div className="card p-8">
                <h3 className="font-bold text-lg mb-2 text-text-primary">💬 WhatsApp</h3>
                <a
                  href="https://wa.me/77005030501"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xl font-bold text-orange-accent hover:underline"
                >
                  +7 700 503 05 01
                </a>
              </div>

              <div className="card p-8">
                <h3 className="font-bold text-lg mb-2 text-text-primary">📧 Email</h3>
                <a href="mailto:salem@shymkent.studio" className="text-lg text-orange-accent hover:underline">
                  salem@shymkent.studio
                </a>
              </div>

              <div className="card p-8">
                <h3 className="font-bold text-lg mb-2 text-text-primary">📱 Instagram</h3>
                <a
                  href="https://instagram.com/shymkent.studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg text-orange-accent hover:underline"
                >
                  @shymkent.studio
                </a>
              </div>

              <div className="card p-8 bg-orange-accent/10 border-orange-accent/20">
                <p className="font-bold text-text-primary mb-3">ℹ️ Информация</p>
                <p className="text-text-secondary mb-4">
                  Студия откроется <strong>10 ноября 2026 года</strong>
                </p>
                <p className="text-text-secondary text-sm">
                  Сейчас мы принимаем заявки на бесплатный тур и бронирование, чтобы занять интересующие вас даты и время.
                </p>
              </div>
            </div>

            <div>
              <div className="bg-border-light rounded-card h-full min-h-96 flex items-center justify-center">
                <p className="text-center text-text-secondary">
                  <span className="font-semibold block text-lg">Карта</span>
                  <span className="text-sm">Интерактивная карта</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Link href="/book" className="card p-8 text-center hover:shadow-lg transition-shadow">
              <p className="text-3xl mb-3">🎬</p>
              <h3 className="font-bold text-text-primary mb-2">Забронировать съёмку</h3>
              <p className="text-sm text-text-secondary mb-4">Выберите дату и время для записи</p>
              <span className="text-orange-accent font-semibold">Забронировать →</span>
            </Link>

            <Link href="/studio-tour" className="card p-8 text-center hover:shadow-lg transition-shadow">
              <p className="text-3xl mb-3">👀</p>
              <h3 className="font-bold text-text-primary mb-2">Бесплатный тур</h3>
              <p className="text-sm text-text-secondary mb-4">Посмотрите комнаты и оборудование</p>
              <span className="text-orange-accent font-semibold">Записаться →</span>
            </Link>

            <a href="https://wa.me/77005030501" target="_blank" rel="noopener noreferrer" className="card p-8 text-center hover:shadow-lg transition-shadow cursor-pointer">
              <p className="text-3xl mb-3">💬</p>
              <h3 className="font-bold text-text-primary mb-2">Написать в WhatsApp</h3>
              <p className="text-sm text-text-secondary mb-4">Быстрый ответ на вопросы</p>
              <span className="text-orange-accent font-semibold">Открыть →</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
