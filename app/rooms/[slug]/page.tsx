import { redirect } from 'next/navigation';

const roomsData: Record<string, any> = {
  large: {
    name: 'Большая подкаст-зона',
    capacity: '4 человека',
    description: 'Просторная комната для групповых обсуждений и интервью с несколькими гостями.',
  },
  small: {
    name: 'Маленькая подкаст-комната',
    capacity: '2 человека',
    description: 'Интимная комната для интервью один-на-один или дуэта.',
  },
  lounge: {
    name: 'Холл / Living Room',
    capacity: '3 человека',
    description: 'Уютная зона с релаксирующей атмосферой для естественного разговора.',
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
            <div className="h-96 bg-border-light rounded-card flex items-center justify-center">
              <p className="text-center text-text-secondary">
                <span className="font-semibold block">Фотография</span>
                <span className="text-sm">Заглушка</span>
              </p>
            </div>

            <div>
              <h2 className="text-3xl font-bold mb-6 text-text-primary">Информация</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-text-primary mb-2">Вместимость</h3>
                  <p className="text-orange-accent font-semibold text-lg">{room.capacity}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-text-primary mb-3">Доступные тарифы</h3>
                  <ul className="space-y-2 text-text-secondary">
                    <li>✓ Запись без монтажа — 15 000 ₸/час</li>
                    <li>✓ Монтаж эпизода — 20 000 ₸</li>
                    <li>✓ Полный подкаст — 30 000 ₸</li>
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
