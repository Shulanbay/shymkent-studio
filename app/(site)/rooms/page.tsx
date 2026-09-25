import { RoomsList } from '@/components/site/RoomsList';

export const metadata = {
  title: 'Комнаты для записи подкастов в Шымкенте | SHYMKENT STUDIO',
  description: 'Три комнаты для записи подкастов и интервью в Шымкенте: большая студия, маленькая комната и Living Room.',
  alternates: { canonical: '/rooms' },
};

export default function RoomsPage() {
  return <RoomsList />;
}
