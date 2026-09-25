'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Decorative hero background video (12 MB). It is loaded only on wide screens,
 * never with prefers-reduced-motion or Data Saver, so phones and slow
 * connections get the plain dark background instead.
 */
export function VideoWave() {
  const [enabled, setEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const update = () => setEnabled(wide.matches && !reduced.matches && !saveData);
    update();
    wide.addEventListener('change', update);
    reduced.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      reduced.removeEventListener('change', update);
    };
  }, []);

  if (!enabled) return null;
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden" aria-hidden="true">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="w-full h-full object-cover"
        style={{ mixBlendMode: 'lighten', filter: 'hue-rotate(15deg) saturate(1.3)', opacity: 0.7 }}
      >
        <source src="/videos/music_bg.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
