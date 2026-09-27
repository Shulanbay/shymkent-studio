import { TermsContent } from '@/components/site/LegalContent';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata(
  '/terms',
  'Порядок бронирования, оплаты, отмены, возврата и переноса записи в SHYMKENT STUDIO.',
);

export default function TermsPage() {
  return <TermsContent />;
}
