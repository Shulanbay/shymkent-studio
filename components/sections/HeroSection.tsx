import Link from 'next/link';
import { RoomImage } from '@/components/RoomImage';

export function HeroSection() {
  return (
    <section className="py-16 md:py-32 bg-gradient-to-b from-bg-light to-bg-card">
      <div className="container-max">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block mb-6 px-4 py-2 bg-orange-accent/10 rounded-full text-orange-accent font-semibold text-sm">
              SHYMKENT STUDIO · Шымкент
            </div>

            <h1 className="mb-6 text-text-primary">Подкаст-студия в Шымкенте</h1>

            <p className="text-xl text-text-secondary mb-8 leading-relaxed">
              Записывайте подкасты и интервью на три камеры с профессиональным звуком. Выберите одну из трёх комнат — получите исходники или готовый эпизод с монтажом.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link href="/book" className="btn-primary text-center">
                Забронировать запись
              </Link>
              <Link href="/studio-tour" className="btn-secondary text-center">
                Бесплатный тур по студии
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 text-text-secondary">
              <div>
                <p className="font-semibold text-text-primary">3 камеры Sony FX30</p>
                <p className="text-sm">Несколько ракурсов для живого разговора</p>
              </div>
              <div>
                <p className="font-semibold text-text-primary">До 4 микрофонов</p>
                <p className="text-sm">По микрофону для каждого участника</p>
              </div>
              <div>
                <p className="font-semibold text-text-primary">От 15 000 ₸/час</p>
                <p className="text-sm">Полный пакет за 30 000 ₸</p>
              </div>
            </div>
          </div>

          <div className="relative h-96 md:h-full min-h-96 rounded-lg overflow-hidden">
            <RoomImage src="/images/rooms/small.jpg" alt="Подкаст-студия SHYMKENT STUDIO" className="h-96" priority />
          </div>
        </div>
      </div>
    </section>
  );
}
