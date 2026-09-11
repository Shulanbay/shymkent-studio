'use client';

export function ExamplesSection() {
  const examples = [
    {
      id: 1,
      title: 'Интервью в маленькой комнате',
      thumbnail: 'https://via.placeholder.com/400x225?text=Интервью',
    },
    {
      id: 2,
      title: 'Групповое обсуждение',
      thumbnail: 'https://via.placeholder.com/400x225?text=Групповое',
    },
    {
      id: 3,
      title: 'Съёмка в Living Room',
      thumbnail: 'https://via.placeholder.com/400x225?text=Living+Room',
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-bg-light">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-text-primary">Портфолио</h2>
          <p className="text-lg text-text-secondary">Примеры записей, снятых в Shymkent Studio</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {examples.map((example) => (
            <div key={example.id} className="group relative rounded-2xl overflow-hidden cursor-pointer">
              <div className="bg-border-light aspect-video flex items-center justify-center overflow-hidden">
                <img
                  src={example.thumbnail}
                  alt={example.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <button className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/50 transition-colors">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-orange-accent ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </div>
                </button>
              </div>
              <p className="mt-4 font-semibold text-text-primary">{example.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
