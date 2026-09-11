'use client';

import { redirect } from 'next/navigation';
import { ImageSlider } from '@/components/ImageSlider';
import { useLanguage } from '@/components/LanguageContext';
import { getTranslation } from '@/lib/translations';

const roomsConfig: Record<string, any> = {
  small: {
    titleKey: 'roomsDescriptions.smallTitle',
    descKey: 'roomsDescriptions.smallDesc',
    capacityLabel: '2',
    size: '3 × 4 м',
    images: [
      '/images/rooms/small.jpg',
      '/images/rooms/small2.jpg',
      '/images/rooms/small3.jpg',
      '/images/rooms/small4.jpg',
    ],
  },
  large: {
    titleKey: 'roomsDescriptions.largeTitle',
    descKey: 'roomsDescriptions.largeDesc',
    capacityLabel: '4',
    size: '3 × 6 м',
    images: [
      '/images/rooms/large.jpg',
      '/images/rooms/large2.jpg',
      '/images/rooms/large3.jpg',
      '/images/rooms/large4.jpg',
    ],
  },
  lounge: {
    titleKey: 'roomsDescriptions.loungeTitle',
    descKey: 'roomsDescriptions.loungeDesc',
    capacityLabel: '3',
    size: '3 × 5 м',
    images: ['/images/rooms/lounge.jpg'],
  },
};

export default function RoomDetailPage({ params }: { params: { slug: string } }) {
  const { language } = useLanguage();
  const room = roomsConfig[params.slug];

  if (!room) {
    redirect('/rooms');
  }

  const roomName = getTranslation(language, room.titleKey);

  return (
    <div className="pt-20">
      <section className="py-16 md:py-32 bg-bg-light">
        <div className="container-max">
          <h1 className="mb-4">{roomName}</h1>
          <p className="text-xl text-text-secondary mb-12">{getTranslation(language, room.descKey)}</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="shadow-lg">
              <ImageSlider images={room.images} alt={roomName} className="h-96 rounded-2xl" />
            </div>

            <div>
              <h2 className="text-3xl font-bold mb-6 text-text-primary">{getTranslation(language, 'roomsDescriptions.information')}</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-text-primary mb-2">{getTranslation(language, 'roomsDescriptions.capacity')}</h3>
                  <p className="text-orange-accent font-semibold text-lg">{room.capacityLabel} {language === 'kk' ? 'адам' : 'человека'}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-text-primary mb-2">{getTranslation(language, 'roomsDescriptions.roomSize')}</h3>
                  <p className="text-text-secondary">{room.size}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-text-primary mb-3">{getTranslation(language, 'roomsDescriptions.availablePackages')}</h3>
                  <ul className="space-y-2 text-text-secondary">
                    <li>✓ {getTranslation(language, 'roomsDescriptions.recording60min')}</li>
                    <li>✓ {getTranslation(language, 'roomsDescriptions.release90min')}</li>
                    <li>✓ {getTranslation(language, 'roomsDescriptions.content90min')}</li>
                  </ul>
                </div>

                <div className="pt-6 border-t border-border-light">
                  <a href={`/book?room=${params.slug}`} className="btn-primary text-center block">
                    {getTranslation(language, 'roomsDescriptions.bookRecording')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
