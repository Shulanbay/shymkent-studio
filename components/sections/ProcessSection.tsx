export function ProcessSection() {
  const steps = [
    {
      number: '01',
      title: 'Выберите студию',
      description: 'Подберите пространство под ваш формат',
    },
    {
      number: '02',
      title: 'Выберите пакет',
      description: 'От записи до готового контента для соцсетей',
    },
    {
      number: '03',
      title: 'Забронируйте дату',
      description: 'Выберите удобное время и оплатите',
    },
    {
      number: '04',
      title: 'Получите результат',
      description: 'Исходники или готовый эпизод в срок',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-white">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">Процесс от начала до конца</h2>
          <p className="text-lg text-text-secondary">Четыре простых шага</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <div className="bg-bg-light rounded-2xl p-8 h-full border border-border-light hover:border-orange-accent transition-colors">
                <div className="text-5xl font-bold text-orange-accent/20 mb-6">{step.number}</div>

                <h3 className="text-lg font-bold text-text-primary mb-3">{step.title}</h3>

                <p className="text-sm text-text-secondary">{step.description}</p>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/4 -right-4 w-8 h-px bg-gradient-to-r from-orange-accent to-transparent" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
