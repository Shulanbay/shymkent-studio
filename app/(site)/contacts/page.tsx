import { ContactsContent } from '@/components/site/ContactsContent';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata(
  '/contacts',
  'Адрес, телефон, WhatsApp и время работы подкаст-студии SHYMKENT STUDIO в Шымкенте.',
);

export default function ContactsPage() {
  return <ContactsContent />;
}
