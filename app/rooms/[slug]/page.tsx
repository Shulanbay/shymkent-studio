import { redirect } from 'next/navigation';
import { ImageSlider } from '@/components/ImageSlider';

const roomsData: Record<string, any> = {
  small: {
    name: 'Маленькая подкаст-комната',
    capacity: '2 человека',
    size: '3 × 4 м',
    description: 'Интимная комната для интервью один-на-один или дуэта.',
    images: [
      '/images/rooms/small.jpg',
      '/images/rooms/small2.jpg',
      '/images/rooms/small3.jpg',
      '/images/rooms/small4.jpg',
    ],
  },
  large: {
    name: 'Большая подкаст-зона',
    capacity: '4 человека',
    size: '3 × 6 м',
    description: 'Просторная комната для групповых обсуждений и интервью с несколькими гостями.',
    images: [
      '/images/rooms/large.jpg',
      '/images/rooms/large2.jpg',
      '/images/rooms/large3.jpg',
      '/images/rooms/large4.jpg',
    ],
  },
  lounge: {
    name: 'Холл / Living Room',
    capacity: '3 человека',
    size: '3 × 5 м',
    description: 'Уютная зона с релаксирующей атмосферой для естественного разговора.',
    images: ['/images/rooms/lounge.jpg'],
  },
};

export default function RoomDetailPage({ params }: { params: { slug: string } }) {
  const room = roomsData[params.slug];

  if (!room) {
    redirect('/rooms');
  }

  return (
    <div className="pt-20">
      <section className="py-16 md:py-32 bg-bg-light">
        <div className="container-max">
          <h1 className="mb-4">{room.name}</h1>
          <p className="text-xl text-text-secondary mb-12">{room.description}</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="shadow-lg">
              <ImageSlider images={room.images} alt={room.name} className="h-96 rounded-2xl" />
            </div>

            <div>
              <h2 className="text-3xl font-bold mb-6 text-text-primary">Информация</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-text-primary mb-2">Вместимость</h3>
                  <p className="text-orange-accent font-semibold text-lg">{room.capacity}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-text-primary mb-2">Размер комнаты</h3>
                  <p className="text-text-secondary">{room.size}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-text-primary mb-3">Доступные пакеты</h3>
                  <ul className="space-y-2 text-text-secondary">
                    <li>✓ Запись (60 мин) — 20 000 ₸</li>
                    <li>✓ Выпуск (90 мин + монтаж) — 40 000 ₸</li>
                    <li>✓ Контент (90 мин + социальный контент) — 60 000 ₸</li>
                  </ul>
                </div>

                <div className="pt-6 border-t border-border-light">
                  <a href={`/book?room=${params.slug}`} className="btn-primary text-center block">
                    Забронировать запись
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
