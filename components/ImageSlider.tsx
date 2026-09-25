'use client';

import { useRef, useState } from 'react';
import { RoomImage } from '@/components/RoomImage';
import { useLanguage } from '@/components/LanguageContext';

interface ImageSliderProps {
  images: string[];
  alt: string;
  className?: string;
  /** Load the first photo eagerly (above the fold). */
  priority?: boolean;
  sizes?: string;
}

export function ImageSlider({ images, alt, className = 'h-96', priority = false, sizes }: ImageSliderProps) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const many = images.length > 1;

  const go = (delta: number) => setCurrentIndex((i) => (i + delta + images.length) % images.length);

  const buttonClass =
    'absolute top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-text-primary rounded-full w-11 h-11 flex items-center justify-center shadow transition-opacity z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100';

  return (
    <div
      className={`relative ${className} rounded-2xl overflow-hidden bg-bg-light group`}
      role={many ? 'region' : undefined}
      aria-roledescription={many ? 'carousel' : undefined}
      aria-label={many ? alt : undefined}
      onTouchStart={(e) => (touchStart.current = e.targetTouches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart.current === null) return;
        const distance = touchStart.current - e.changedTouches[0].clientX;
        if (Math.abs(distance) > 50) go(distance > 0 ? 1 : -1);
        touchStart.current = null;
      }}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
    >
      <div className="relative w-full h-full overflow-hidden">
        <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
          {images.map((image, index) => (
            <div key={image} className="min-w-full h-full flex-shrink-0" aria-hidden={index !== currentIndex}>
              <RoomImage
                src={image}
                alt={t('common.photo').replace('{name}', alt).replace('{n}', String(index + 1))}
                className="h-full"
                priority={priority && index === 0}
                sizes={sizes}
              />
            </div>
          ))}
        </div>
      </div>

      {many && (
        <>
          <button type="button" onClick={() => go(-1)} className={`${buttonClass} left-3`} aria-label={t('common.prevPhoto')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button type="button" onClick={() => go(1)} className={`${buttonClass} right-3`} aria-label={t('common.nextPhoto')}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex z-10">
            {images.map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className="w-7 h-7 flex items-center justify-center"
                aria-label={t('common.goToPhoto').replace('{n}', String(index + 1))}
                aria-current={index === currentIndex ? 'true' : undefined}
              >
                <span className={`block h-2 rounded-full transition-all ${index === currentIndex ? 'bg-orange-bright w-6' : 'bg-white/80 w-2'}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
