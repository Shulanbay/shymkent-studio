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
        'orange-accent': '#FF6B24',
        'orange-light': '#FF9A44',
        'border-light': '#EDE5DD',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'lg': '24px',
      },
      backgroundImage: {
        'gradient-orange': 'linear-gradient(135deg, #FF6B24 0%, #FF9A44 100%)',
        'gradient-orange-dark': 'linear-gradient(135deg, #FF6B24 0%, #FF8533 100%)',
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
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(255, 107, 36, 0.7)' },
          '50%': { boxShadow: '0 0 0 10px rgba(255, 107, 36, 0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
