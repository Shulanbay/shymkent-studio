export function EquipmentSection() {
  const equipment = [
    {
      name: 'Sony FX30',
      quantity: '3 камеры',
      description: 'Несколько ракурсов для живого разговора и профессиональной картинки',
    },
    {
      name: 'Shure SM7B',
      quantity: 'до 4 микрофонов',
      description: 'Отдельный микрофон для каждого участника, чистый звук без помех',
    },
    {
      name: 'RØDECaster Pro II',
      quantity: 'Профессиональная запись',
      description: 'Звуковой интерфейс для чистой и качественной записи аудиодорожки',
    },
  ];

  return (
    <section className="py-16 md:py-32 bg-bg-light">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">Профессиональная картинка и звук</h2>
          <p className="text-xl text-text-secondary">Оборудование студии мирового класса</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {equipment.map((item) => (
            <div key={item.name} className="card p-8 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-gradient-accent rounded-lg mx-auto mb-6 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">📹</span>
              </div>

              <h3 className="text-xl font-bold mb-2 text-text-primary">{item.name}</h3>

              <p className="font-semibold text-orange-accent mb-3">{item.quantity}</p>

              <p className="text-text-secondary">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
