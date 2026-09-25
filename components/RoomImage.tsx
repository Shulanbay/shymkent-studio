'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/components/LanguageContext';

interface RoomImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export function RoomImage({ src, alt, className = '', priority = false, sizes }: RoomImageProps) {
  const { t } = useLanguage();
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`relative bg-gradient-to-br from-border-light to-orange-accent/10 overflow-hidden ${className}`}>
      {!imageError ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          priority={priority}
          sizes={sizes ?? '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-6 text-center text-text-secondary text-sm" role="img" aria-label={alt}>
          {t('common.photoUnavailable')}
        </div>
      )}
    </div>
  );
}
