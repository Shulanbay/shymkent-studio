import { PrivacyContent } from '@/components/site/LegalContent';

export const metadata = {
  alternates: { canonical: '/privacy' },
  title: 'Политика конфиденциальности | SHYMKENT STUDIO',
  description: 'Какие персональные данные собирает SHYMKENT STUDIO, зачем, где они хранятся и как их удалить.',
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
