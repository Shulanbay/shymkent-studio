'use client';

import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

export function ExamplesSection() {
  const { language } = useLanguage();

  const examples = [
    {
      id: 1,
      titleKey: 'examples.video1',
      videoId: 'PnKCeCr6LaI',
    },
    {
      id: 2,
      titleKey: 'examples.video2',
      videoId: 'nBtUqOjT424',
    },
    {
      id: 3,
      titleKey: 'examples.video3',
      videoId: 'K_XuHRHJR4E',
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-black">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="mb-4 text-white">{getTranslation(language, 'examples.title')}</h2>
          <p className="text-lg text-gray-300">{getTranslation(language, 'examples.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {examples.map((example) => (
            <div key={example.id} className="group relative rounded-2xl overflow-hidden">
              <div className="bg-border-light aspect-video overflow-hidden rounded-2xl">
                <iframe
                  src={`https://www.youtube.com/embed/${example.videoId}`}
                  title={getTranslation(language, example.titleKey)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="mt-4 font-semibold text-white">{getTranslation(language, example.titleKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
