import type { Metadata } from 'next';
import { HeroSection } from '@/components/sections/HeroSection';
import { RoomsSection } from '@/components/sections/RoomsSection';
import { PricingSection } from '@/components/sections/PricingSection';
import { EquipmentSection } from '@/components/sections/EquipmentSection';
import { ProcessSection } from '@/components/sections/ProcessSection';
import { ExamplesSection } from '@/components/sections/ExamplesSection';
import { TourSection } from '@/components/sections/TourSection';
import { FAQSection } from '@/components/sections/FAQSection';
import { getPublicCatalog } from '@/lib/public-catalog';

const price = (value: number | undefined) => (value ?? 0).toLocaleString('ru-RU').replace(/ /g, ' ');

export async function generateMetadata(): Promise<Metadata> {
  const { services } = await getPublicCatalog();
  const min = services.length ? Math.min(...services.map((s) => s.basePrice)) : undefined;
  const pro = services.find((s) => s.slug === 'pro')?.basePrice;
  return {
    alternates: { canonical: '/' },
    description: `Запись подкастов в Шымкенте: 3 комнаты, камеры Sony FX30 и микрофоны Shure SM7B.${min ? ` Запись от ${price(min)} ₸` : ''}${pro ? `, готовый эпизод с монтажом от ${price(pro)} ₸` : ''}. Бесплатный тур по студии.`,
  };
}

export default function Home() {
  return (
    <div>
      <HeroSection />
      <RoomsSection />
      <PricingSection />
      <EquipmentSection />
      <ProcessSection />
      <ExamplesSection />
      <TourSection />
      <FAQSection />
    </div>
  );
}
