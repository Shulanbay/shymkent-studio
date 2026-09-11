import Link from 'next/link';
import { ImageSlider } from '@/components/ImageSlider';

const rooms = [
  {
    id: 'small',
    name: 'Маленькая комната',
    capacity: '2 человека',
    size: '3 × 4 м',
    description: 'Интимное пространство для один-на-один интервью с идеальной акустикой.',
    images: ['/images/rooms/small.jpg', '/images/rooms/small.jpg', '/images/rooms/small.jpg'],
    slug: 'small',
  },
  {
    id: 'large',
    name: 'Большая студия',
    capacity: '4 человека',
    size: '3 × 6 м',
    description: 'Просторная зона для групповых дискуссий и многолюдных записей.',
    images: ['/images/rooms/large.jpg', '/images/rooms/large.jpg', '/images/rooms/large.jpg'],
    slug: 'large',
  },
  {
    id: 'lounge',
    name: 'Living Room',
    capacity: '3 человека',
    size: '3 × 5 м',
    description: 'Релаксирующая атмосфера с мраморным столом для естественных разговоров.',
    images: ['/images/rooms/lounge.jpg', '/images/rooms/lounge.jpg', '/images/rooms/lounge.jpg'],
    slug: 'lounge',
  },
];

export function RoomsSection() {
  return (
    <section id="rooms" className="py-20 md:py-32 bg-bg-light">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">Три пространства</h2>
          <p className="text-lg text-text-secondary">Выберите студию, которая подходит вам (свайпайте для просмотра)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {rooms.map((room) => (
            <Link key={room.id} href={`/rooms/${room.slug}`}>
              <div className="group cursor-pointer">
                <div className="mb-6 shadow-sm group-hover:shadow-lg transition-all duration-300">
                  <ImageSlider
                    images={room.images}
                    alt={room.name}
                    className="h-64 rounded-2xl"
                  />
                </div>

                <h3 className="text-xl font-bold mb-2 text-text-primary">{room.name}</h3>

                <div className="mb-4 flex items-center gap-4 text-sm">
                  <span className="text-orange-accent font-semibold">{room.capacity}</span>
                  <span className="text-text-secondary">{room.size}</span>
                </div>

                <p className="text-text-secondary mb-6 line-clamp-2">{room.description}</p>

                <div className="inline-flex items-center gap-2 text-orange-accent font-semibold hover:gap-3 transition-all">
                  Подробнее
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
