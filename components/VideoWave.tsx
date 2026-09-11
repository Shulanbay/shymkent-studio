'use client';

export function VideoWave() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
        style={{
          mixBlendMode: 'lighten',
          filter: 'hue-rotate(15deg) saturate(1.3)',
          opacity: 0.7,
        }}
      >
        <source src="/videos/music_bg.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
