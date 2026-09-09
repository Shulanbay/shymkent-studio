import Link from 'next/link';
import { RoomImage } from '@/components/RoomImage';

const rooms = [
  {
    id: 'small',
    name: 'Маленькая подкаст-комната',
    capacity: '2 человека',
    size: '3 × 4 м',
    description: 'Интимная комната для интервью один-на-один или дуэта',
    image: '/images/rooms/small.jpg',
    slug: 'small',
  },
  {
    id: 'large',
    name: 'Большая подкаст-зона',
    capacity: '4 человека',
    size: '3 × 6 м',
    description: 'Просторная комната для групповых обсуждений и интервью с несколькими гостями',
    image: '/images/rooms/large.jpg',
    slug: 'large',
  },
  {
    id: 'lounge',
    name: 'Холл / Living Room',
    capacity: '3 человека',
    size: '3 × 5 м',
    description: 'Уютная зона с релаксирующей атмосферой для естественного разговора и round-table setup',
    image: '/images/rooms/lounge.jpg',
    slug: 'lounge',
  },
];

export function RoomsSection() {
  return (
    <section className="py-16 md:py-32 bg-bg-light">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">Три комнаты. Выберите свою атмосферу</h2>
          <p className="text-xl text-text-secondary">Каждая комната создана для разных форматов записи</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="card p-6 md:p-8 flex flex-col h-full hover:shadow-lg transition-shadow">
              <div className="h-48 rounded-card mb-6 overflow-hidden">
                <RoomImage src={room.image} alt={room.name} className="h-48" />
              </div>

              <h3 className="text-2xl font-bold mb-2 text-text-primary">{room.name}</h3>

              <div className="mb-4">
                <p className="text-orange-accent font-semibold">{room.capacity}</p>
                <p className="text-sm text-text-secondary">{room.size}</p>
              </div>

              <p className="text-text-secondary mb-8 flex-grow">{room.description}</p>

              <Link href={`/rooms/${room.slug}`} className="btn-secondary text-center">
                Посмотреть комнату
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
