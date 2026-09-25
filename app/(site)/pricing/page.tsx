import type { Metadata } from 'next';
import { PricingSection } from '@/components/sections/PricingSection';
import { PricingTerms } from '@/components/site/PricingTerms';
import { getPublicCatalog } from '@/lib/public-catalog';

const price = (value: number | undefined) => (value ?? 0).toLocaleString('ru-RU').replace(/ /g, ' ');

export async function generateMetadata(): Promise<Metadata> {
  const { services } = await getPublicCatalog();
  const of = (slug: string) => services.find((s) => s.slug === slug)?.basePrice;
  return {
    alternates: { canonical: '/pricing' },
    title: 'Цены на запись подкастов в Шымкенте | SHYMKENT STUDIO',
    description: `Тарифы на запись и монтаж подкастов в Шымкенте: запись от ${price(of('starter'))} ₸, готовый эпизод с монтажом от ${price(of('pro'))} ₸, контент для соцсетей от ${price(of('premium'))} ₸.`,
  };
}

export default function PricingPage() {
  return (
    <div className="pt-20 min-h-screen">
      <PricingSection asPage />
      <PricingTerms />
    </div>
  );
}
