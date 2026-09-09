'use client';

export function ExamplesSection() {
  const examples = [
    {
      id: 1,
      title: 'Пример интервью',
      thumbnail: 'https://via.placeholder.com/400x225?text=Пример+1',
    },
    {
      id: 2,
      title: 'Групповое обсуждение',
      thumbnail: 'https://via.placeholder.com/400x225?text=Пример+2',
    },
    {
      id: 3,
      title: 'Профессиональная запись',
      thumbnail: 'https://via.placeholder.com/400x225?text=Пример+3',
    },
  ];

  return (
    <section className="py-16 md:py-32 bg-bg-light">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">Посмотрите, как выглядит запись</h2>
          <p className="text-xl text-text-secondary">Примеры работ нашей команды</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {examples.map((example) => (
            <div key={example.id} className="group relative rounded-lg overflow-hidden cursor-pointer">
              <div className="bg-border-light aspect-video flex items-center justify-center">
                <button className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-orange-accent ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </div>
                </button>
              </div>
              <p className="mt-4 font-semibold text-text-primary">{example.title}</p>
              <p className="text-sm text-text-secondary">Пример работы Film Me Studio, Нью-Йорк</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
