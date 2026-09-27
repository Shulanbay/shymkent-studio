import { RoomsList } from '@/components/site/RoomsList';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata(
  '/rooms',
  'Три комнаты для записи подкастов и интервью в Шымкенте: большая студия, маленькая комната и Living Room.',
);

export default function RoomsPage() {
  return <RoomsList />;
}
