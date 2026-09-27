'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/LanguageContext';

const EXAMPLES = [
  { titleKey: 'examples.video1', videoId: 'PnKCeCr6LaI' },
  { titleKey: 'examples.video2', videoId: 'nBtUqOjT424' },
  { titleKey: 'examples.video3', videoId: 'K_XuHRHJR4E' },
];

/**
 * Click-to-load YouTube: nothing is requested from YouTube until the visitor
 * presses play (faster first load, no third-party cookies before consent).
 */
function LiteYouTube({ videoId, title }: { videoId: string; title: string }) {
  const { t } = useLanguage();
  const [active, setActive] = useState(false);
  if (active) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
        title={title}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      className="relative w-full h-full group/play bg-black"
      aria-label={t('examples.play').replace('{title}', title)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnail; next/image would proxy a third-party image */}
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover opacity-90 group-hover/play:opacity-100 transition-opacity"
      />
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className="w-16 h-16 rounded-full bg-brand-gradient text-on-brand flex items-center justify-center shadow-lg group-hover/play:scale-105 transition-transform">
          <svg className="w-7 h-7 ml-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}

export function ExamplesSection() {
  const { t } = useLanguage();
  return (
    <section className="py-20 md:py-32 bg-white" aria-labelledby="examples-title">
      <div className="container-max">
        <div className="text-center mb-12 md:mb-16">
          <h2 id="examples-title" className="mb-4 text-text-primary">
            {t('examples.title')}
          </h2>
          <p className="text-lg text-text-secondary">{t('examples.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {EXAMPLES.map((example) => {
            const title = t(example.titleKey);
            return (
              <figure key={example.videoId}>
                <div className="bg-border-light aspect-video overflow-hidden rounded-2xl">
                  <LiteYouTube videoId={example.videoId} title={title} />
                </div>
                <figcaption className="mt-4 font-semibold text-text-primary">{title}</figcaption>
              </figure>
            );
          })}
        </div>
        <p className="text-center text-xs text-text-secondary mt-6">{t('examples.consent')}</p>
      </div>
    </section>
  );
}
