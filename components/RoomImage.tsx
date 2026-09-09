import Image from 'next/image';

interface RoomImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function RoomImage({ src, alt, className = '', priority = false }: RoomImageProps) {
  return (
    <div className={`relative bg-border-light rounded-card overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        priority={priority}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  );
}
