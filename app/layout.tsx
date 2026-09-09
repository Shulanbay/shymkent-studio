import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'Подкаст-студия в Шымкенте — запись и монтаж | SHYMKENT STUDIO',
  description: 'Запись подкастов в Шымкенте: 3 комнаты, камеры Sony FX30 и микрофоны Shure SM7B. От 15 000 ₸/час. Съёмка до 90 минут и монтаж — 30 000 ₸.',
  openGraph: {
    title: 'Подкаст-студия в Шымкенте | SHYMKENT STUDIO',
    description: 'Запись подкастов в Шымкенте с профессиональным оборудованием',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
