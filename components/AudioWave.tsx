'use client';

export function AudioWave() {
  return (
    <div className="w-full" style={{ height: '200px' }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 800 200"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Animated audio waves */}
        <defs>
          <style>{`
            @keyframes wave1 {
              0%, 100% { d: path('M 0,100 Q 50,80 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
              25% { d: path('M 0,100 Q 50,40 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
              50% { d: path('M 0,100 Q 50,80 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
              75% { d: path('M 0,100 Q 50,140 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
            }

            @keyframes wave2 {
              0%, 100% { d: path('M 0,100 Q 50,90 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
              25% { d: path('M 0,100 Q 50,60 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
              50% { d: path('M 0,100 Q 50,90 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
              75% { d: path('M 0,100 Q 50,120 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
            }

            @keyframes wave3 {
              0%, 100% { d: path('M 0,100 Q 50,95 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
              25% { d: path('M 0,100 Q 50,50 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
              50% { d: path('M 0,100 Q 50,95 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
              75% { d: path('M 0,100 Q 50,130 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100'); }
            }

            .wave-1 { animation: wave1 4s ease-in-out infinite; }
            .wave-2 { animation: wave2 4s ease-in-out infinite 0.15s; }
            .wave-3 { animation: wave3 4s ease-in-out infinite 0.3s; }
          `}</style>
        </defs>

        {/* Background gradient */}
        <defs>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF6B24" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#FF9A44" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FF6B24" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Animated wave paths */}
        <path
          className="wave-1"
          stroke="url(#waveGradient)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          d="M 0,100 Q 50,80 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100"
        />
        <path
          className="wave-2"
          stroke="#FF6B24"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
          d="M 0,100 Q 50,90 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100"
        />
        <path
          className="wave-3"
          stroke="#FF9A44"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.4"
          d="M 0,100 Q 50,95 100,100 T 200,100 T 300,100 T 400,100 T 500,100 T 600,100 T 700,100 T 800,100"
        />

        {/* Center circle (recording indicator) */}
        <circle cx="400" cy="100" r="6" fill="#FF6B24" opacity="0.8" />
        <circle cx="400" cy="100" r="12" fill="none" stroke="#FF6B24" strokeWidth="2" opacity="0.3">
          <animate attributeName="r" values="12;20" dur="2s" repeatCount="indefinite" />
          <animate attributeName="stroke-width" values="2;0" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
