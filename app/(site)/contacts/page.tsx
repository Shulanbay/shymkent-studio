import { ContactsContent } from '@/components/site/ContactsContent';

export const metadata = {
  alternates: { canonical: '/contacts' },
  title: 'Контакты подкаст-студии в Шымкенте | SHYMKENT STUDIO',
  description: 'Адрес, телефон, WhatsApp и время работы подкаст-студии SHYMKENT STUDIO в Шымкенте.',
};

export default function ContactsPage() {
  return <ContactsContent />;
}
