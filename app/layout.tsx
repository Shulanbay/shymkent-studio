import type { Metadata, Viewport } from 'next';
import { Onest } from 'next/font/google';
import './globals.css';
import { publicSiteUrl } from '@/lib/seo';

// Self-hosted at build time (no request to Google from the visitor's browser).
// cyrillic-ext carries the Kazakh letters (ә ғ қ ң ө ұ ү һ).
const onest = Onest({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-onest',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl()),
  title: 'Подкаст-студия в Шымкенте — запись и монтаж | SHYMKENT STUDIO',
  description:
    'Запись подкастов в Шымкенте: 3 комнаты, камеры Sony FX30 и микрофоны Shure SM7B. Запись от 20 000 ₸, готовый эпизод с монтажом от 40 000 ₸.',
  applicationName: 'SHYMKENT STUDIO',
  openGraph: {
    title: 'Подкаст-студия в Шымкенте | SHYMKENT STUDIO',
    description: 'Запись подкастов и интервью в Шымкенте: три комнаты, профессиональные камеры, свет и звук.',
    type: 'website',
    locale: 'ru_KZ',
    alternateLocale: ['kk_KZ'],
    siteName: 'SHYMKENT STUDIO',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang is "ru" in the HTML; the public site switches it on the client when the
  // visitor chooses Kazakh (see LanguageContext).
  return (
    <html lang="ru" className={onest.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
