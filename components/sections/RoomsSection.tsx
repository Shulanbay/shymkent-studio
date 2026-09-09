import Link from 'next/link';

const rooms = [
  {
    id: 'large',
    name: 'Большая подкаст-зона',
    capacity: '4 человека',
    description: 'Просторная комната для групповых обсуждений и интервью с несколькими гостями',
    slug: 'large',
  },
  {
    id: 'small',
    name: 'Маленькая подкаст-комната',
    capacity: '2 человека',
    description: 'Интимная комната для интервью один-на-один или дуэта',
    slug: 'small',
  },
  {
    id: 'lounge',
    name: 'Холл / Living Room',
    capacity: '3 человека',
    description: 'Уютная зона с релаксирующей атмосферой для естественного разговора',
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
              <div className="h-48 bg-border-light rounded-card mb-6 flex items-center justify-center">
                <p className="text-text-secondary text-center">
                  <span className="font-semibold block">Фото: {room.name}</span>
                  <span className="text-sm">Заглушка</span>
                </p>
              </div>

              <h3 className="text-2xl font-bold mb-2 text-text-primary">{room.name}</h3>

              <p className="text-orange-accent font-semibold mb-4">{room.capacity}</p>

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
