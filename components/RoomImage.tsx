'use client';

import { useState } from 'react';
import Image from 'next/image';

interface RoomImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function RoomImage({ src, alt, className = '', priority = false }: RoomImageProps) {
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
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-border-light to-orange-accent/10">
          <div className="text-center text-text-secondary p-6">
            <p className="text-lg font-semibold mb-1">📸 Фотография комнаты</p>
            <p className="text-sm">Загрузка фото...</p>
          </div>
        </div>
      )}
    </div>
  );
}
