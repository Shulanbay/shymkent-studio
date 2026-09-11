'use client';

export function ExamplesSection() {
  const examples = [
    {
      id: 1,
      title: 'Интервью в маленькой комнате',
      videoId: 'PnKCeCr6LaI',
    },
    {
      id: 2,
      title: 'Групповое обсуждение',
      videoId: 'nBtUqOjT424',
    },
    {
      id: 3,
      title: 'Съёмка в Living Room',
      videoId: 'K_XuHRHJR4E',
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
            <div key={example.id} className="group relative rounded-2xl overflow-hidden">
              <div className="bg-border-light aspect-video overflow-hidden rounded-2xl">
                <iframe
                  src={`https://www.youtube.com/embed/${example.videoId}`}
                  title={example.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="mt-4 font-semibold text-text-primary">{example.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
