import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RoomDetail } from '@/components/site/RoomDetail';
import { ROOM_CONTENT, ROOM_META, roomContent } from '@/lib/rooms-content';

// The three rooms are pre-rendered; any other slug renders notFound() (a real 404).
export function generateStaticParams() {
  return ROOM_CONTENT.map((room) => ({ slug: room.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const room = roomContent(slug);
  if (!room) return {};
  const meta = ROOM_META[room.slug];
  return {
    title: `${meta.title} | SHYMKENT STUDIO`,
    description: meta.description,
    alternates: { canonical: `/rooms/${room.slug}` },
    openGraph: { images: [{ url: room.images[0] }] },
  };
}

export default async function RoomDetailPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const room = roomContent(slug);
  if (!room) notFound();
  return <RoomDetail slug={room.slug} />;
}
