import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-light': '#FFFCF8',
        'bg-card': '#FFFFFF',
        'text-primary': '#171717',
        'text-secondary': '#65605B',
        // Brand orange — the single source of truth (mirrored as CSS variables in app/globals.css).
        // Contrast (WCAG 2.1): see README «Цвета».
        brand: {
          // Bright brand orange: fills, gradients, accents on dark backgrounds (8:1 with black).
          DEFAULT: '#FF7A1A',
          light: '#FF9A4D',
          // Saturated shade: hover, gradient end, large text / icons / focus rings on light backgrounds (≥ 3:1).
          strong: '#EA580C',
          // Small orange text on light backgrounds (5.2:1 on white, AA).
          ink: '#C2410C',
          // Tinted surface for notes and highlights.
          soft: '#FFF3E8',
        },
        // Warm dark text on brand fills and gradients (≥ 6.6:1 across the whole gradient).
        'on-brand': '#2A1608',
        'border-light': '#EDE5DD',
      },
      fontFamily: {
        sans: ['var(--font-onest)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'lg': '24px',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(80deg, #FFC38F 0%, #FF8A3D 100%)',
        'brand-gradient-hover': 'linear-gradient(80deg, #FFB47A 0%, #FF7A26 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'float': 'float 3s ease-in-out infinite',
        'slide-in': 'slideIn 0.5s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(255, 122, 26, 0.7)' },
          '50%': { boxShadow: '0 0 0 10px rgba(255, 122, 26, 0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
