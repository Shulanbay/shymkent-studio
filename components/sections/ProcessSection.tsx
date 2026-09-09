export function ProcessSection() {
  const steps = [
    {
      number: '01',
      title: 'Выберите и забронируйте',
      description: 'Выберите комнату, услугу, дату и время в удобном интерфейсе',
    },
    {
      number: '02',
      title: 'Получите подтверждение',
      description: 'После оплаты вы получите номер бронирования и все детали',
    },
    {
      number: '03',
      title: 'Приезжайте на съёмку',
      description: 'Мы встретим вас, настроим оборудование и начнём запись',
    },
    {
      number: '04',
      title: 'Получите результат',
      description: 'Исходники за 24 часа или готовый эпизод через 3 рабочих дня',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-32 bg-bg-card">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">От бронирования до готового выпуска</h2>
          <p className="text-xl text-text-secondary">Простой и быстрый процесс</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <div className="card p-8 h-full">
                <div className="text-5xl font-bold text-orange-accent/20 mb-4">{step.number}</div>

                <h3 className="text-xl font-bold text-text-primary mb-3">{step.title}</h3>

                <p className="text-text-secondary">{step.description}</p>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-orange-accent/30 transform -translate-y-1/2" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
