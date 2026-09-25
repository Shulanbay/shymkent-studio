import { Suspense } from 'react';
import { BookingForm } from '@/components/booking/BookingForm';
import { BookingTitle } from '@/components/booking/BookingTitle';

export const metadata = {
  alternates: { canonical: '/book' },
  title: 'Забронировать запись подкаста | SHYMKENT STUDIO',
  description: 'Онлайн-запись в подкаст-студию в Шымкенте: выберите тариф, комнату и свободное время.',
};

export default function BookingPage() {
  return (
    <div className="pt-20 min-h-screen bg-bg-light">
      <div className="container-max py-12 md:py-24">
        <BookingTitle />
        {/* useSearchParams (?service=, ?room=) needs a Suspense boundary for static rendering. */}
        <Suspense fallback={<div className="bg-white rounded-card p-8 border border-border-light h-96" aria-busy="true" />}>
          <BookingForm />
        </Suspense>
      </div>
    </div>
  );
}
