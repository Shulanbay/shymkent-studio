import Link from 'next/link';
import { RoomImage } from '@/components/RoomImage';

const rooms = [
  {
    id: 'small',
    name: 'Маленькая подкаст-комната',
    capacity: '2 человека',
    size: '3 × 4 м',
    description: 'Интимная комната для интервью один-на-один, дуэта или глубокого разговора.',
    features: [
      'Размер: 3 × 4 м',
      'Вместимость: 2 человека',
      'Уютная атмосфера',
      'Минимальные отвлечения',
      'Идеально для фокусированной записи',
      'Мраморный круглый стол',
    ],
    image: '/images/rooms/small.jpg',
    slug: 'small',
  },
  {
    id: 'large',
    name: 'Большая подкаст-зона',
    capacity: '4 человека',
    size: '3 × 6 м',
    description: 'Просторная комната для групповых обсуждений, интервью с несколькими гостями и круглых столов.',
    features: [
      'Размер: 3 × 6 м',
      'Вместимость: до 4 человек',
      'Большой деревянный стол',
      'Профессиональное освещение',
      'Встроенные полки для декора и оборудования',
      'Комфортные кресла для участников',
    ],
    image: '/images/rooms/large.jpg',
    slug: 'large',
  },
  {
    id: 'lounge',
    name: 'Холл / Living Room',
    capacity: '3 человека',
    size: '3 × 5 м',
    description: 'Уютная зона с релаксирующей атмосферой для естественного и живого разговора.',
    features: [
      'Размер: 3 × 5 м',
      'Вместимость: до 3 человек',
      'Round-table setup для естественного разговора',
      'Домашняя, расслабленная атмосфера',
      'Архитектурные полки с декором',
      'Идеально для интервью и подкастов',
    ],
    image: '/images/rooms/lounge.jpg',
    slug: 'lounge',
  },
];

export default function RoomsPage() {
  return (
    <div className="pt-20">
      <section className="py-16 md:py-32 bg-bg-light">
        <div className="container-max">
          <h1 className="mb-4">Наши комнаты</h1>
          <p className="text-xl text-text-secondary mb-12">
            Выберите комнату, которая подходит для вашего проекта
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {rooms.map((room) => (
              <div key={room.id} className="flex flex-col">
                <div className="h-64 rounded-card mb-8 overflow-hidden">
                  <RoomImage src={room.image} alt={room.name} className="h-64" priority={room.id === 'small'} />
                </div>

                <h2 className="text-3xl font-bold mb-3 text-text-primary">{room.name}</h2>

                <div className="mb-4">
                  <p className="text-lg text-orange-accent font-semibold">{room.capacity}</p>
                  <p className="text-sm text-text-secondary">{room.size}</p>
                </div>

                <p className="text-text-secondary mb-8 leading-relaxed flex-grow">{room.description}</p>

                <div className="mb-8">
                  <h3 className="font-semibold text-text-primary mb-4">Особенности:</h3>
                  <ul className="space-y-2">
                    {room.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-text-secondary">
                        <svg className="w-5 h-5 text-orange-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <Link href={`/book?room=${room.slug}`} className="btn-primary text-center">
                  Забронировать запись в этой комнате
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
