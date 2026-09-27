import { PrivacyContent } from '@/components/site/LegalContent';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata(
  '/privacy',
  'Какие персональные данные собирает SHYMKENT STUDIO, зачем, где они хранятся и как их удалить.',
);

export default function PrivacyPage() {
  return <PrivacyContent />;
}
