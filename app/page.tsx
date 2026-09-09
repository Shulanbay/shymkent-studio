import Link from 'next/link';
import { HeroSection } from '@/components/sections/HeroSection';
import { RoomsSection } from '@/components/sections/RoomsSection';
import { PricingSection } from '@/components/sections/PricingSection';
import { EquipmentSection } from '@/components/sections/EquipmentSection';
import { ProcessSection } from '@/components/sections/ProcessSection';
import { ExamplesSection } from '@/components/sections/ExamplesSection';
import { TourSection } from '@/components/sections/TourSection';
import { FAQSection } from '@/components/sections/FAQSection';

export default function Home() {
  return (
    <div className="pt-20">
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
