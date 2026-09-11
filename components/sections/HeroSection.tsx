import Link from 'next/link';
import { RoomImage } from '@/components/RoomImage';

export function HeroSection() {
  return (
    <section className="py-20 md:py-48 bg-white relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-accent/5 via-transparent to-transparent pointer-events-none"></div>

      <div className="container-max relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column */}
          <div>
            <div className="inline-block mb-8 px-4 py-2 bg-orange-accent/10 rounded-full text-orange-accent font-semibold text-sm">
              SHYMKENT STUDIO
            </div>

            <h1 className="mb-8 text-text-primary leading-tight">
              Профессиональный подкаст начинается здесь
            </h1>

            <p className="text-lg text-text-secondary mb-8 leading-relaxed max-w-lg">
              3 камеры Sony FX30 · Shure SM7B · профессиональный свет и звук · 3 уникальные студии в Шымкенте
            </p>

            {/* Price highlights */}
            <div className="grid grid-cols-2 gap-6 mb-12">
              <div className="bg-bg-light rounded-lg p-4">
                <p className="text-text-secondary text-sm mb-1">Starter</p>
                <p className="text-3xl font-bold text-orange-accent">20 000 ₸</p>
              </div>
              <div className="bg-bg-light rounded-lg p-4">
                <p className="text-text-secondary text-sm mb-1">Pro</p>
                <p className="text-3xl font-bold text-orange-accent">40 000 ₸</p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/book" className="btn-primary text-center">
                Забронировать студию
              </Link>
              <Link href="/studio-tour" className="btn-secondary text-center">
                Бесплатный тур
              </Link>
            </div>
          </div>

          {/* Right column - Hero image */}
          <div className="relative">
            <div className="relative h-96 md:h-full min-h-96 rounded-2xl overflow-hidden shadow-lg">
              <RoomImage src="/images/rooms/small4.jpg" alt="Подкаст-студия SHYMKENT STUDIO" className="h-full w-full object-cover" priority />
            </div>
            {/* Decorative accent */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-orange-accent/10 rounded-full blur-2xl pointer-events-none"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
