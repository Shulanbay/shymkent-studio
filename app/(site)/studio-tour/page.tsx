import { TourForm } from '@/components/tour/TourForm';
import { TourIntro } from '@/components/tour/TourIntro';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata(
  '/studio-tour',
  'Запишитесь на бесплатную экскурсию по SHYMKENT STUDIO: три комнаты, оборудование и консультация по проекту.',
);

export default function StudioTourPage() {
  return (
    <div className="min-h-screen bg-bg-light">
      <div className="container-max py-12 md:py-24">
        <div className="max-w-2xl mx-auto">
          <TourIntro />
          <TourForm />
        </div>
      </div>
    </div>
  );
}
