import { TourForm } from '@/components/tour/TourForm';
import { TourIntro } from '@/components/tour/TourIntro';

export const metadata = {
  alternates: { canonical: '/studio-tour' },
  title: 'Бесплатный тур по подкаст-студии | SHYMKENT STUDIO',
  description: 'Запишитесь на бесплатную экскурсию по SHYMKENT STUDIO: три комнаты, оборудование и консультация по проекту.',
};

export default function StudioTourPage() {
  return (
    <div className="pt-20 min-h-screen bg-bg-light">
      <div className="container-max py-12 md:py-24">
        <div className="max-w-2xl mx-auto">
          <TourIntro />
          <TourForm />
        </div>
      </div>
    </div>
  );
}
