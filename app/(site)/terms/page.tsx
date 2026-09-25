import { TermsContent } from '@/components/site/LegalContent';

export const metadata = {
  alternates: { canonical: '/terms' },
  title: 'Условия бронирования и оплаты | SHYMKENT STUDIO',
  description: 'Порядок бронирования, оплаты, отмены, возврата и переноса записи в SHYMKENT STUDIO.',
};

export default function TermsPage() {
  return <TermsContent />;
}
