'use client';

import Link from 'next/link';
import { useCatalog } from '@/components/CatalogContext';
import { useLanguage } from '@/components/LanguageContext';
import { addressFor, formatLongDate, isBeforeOpening, phoneHref } from '@/lib/contacts';
import { todayInStudio } from '@/lib/time';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 md:p-8">
      <h2 className="font-bold text-lg mb-2 text-text-primary">{title}</h2>
      {children}
    </div>
  );
}

export function ContactsContent() {
  const { contacts, openingHours } = useCatalog();
  const { language, t } = useLanguage();
  const address = addressFor(contacts, language);
  const newTab = <span className="sr-only"> {t('common.opensInNewTab')}</span>;
  const showOpening = isBeforeOpening(contacts.openingDate, todayInStudio());
  const hoursByDay = new Map(openingHours.map((h) => [h.day, h]));

  return (
    <div>
      <section className="py-12 md:py-24 bg-bg-light">
        <div className="container-max">
          <h1 className="mb-4">{t('contactsPage.title')}</h1>
          <p className="text-lg md:text-xl text-text-secondary mb-10 md:mb-12">{t('contactsPage.subtitle')}</p>

          {showOpening && (
            <div className="card p-6 md:p-8 mb-8 border-orange-accent/30 bg-orange-50" role="note">
              <p className="font-bold text-text-primary mb-2">{t('contactsPage.openingTitle')}</p>
              <p className="text-text-primary mb-2">
                {t('contactsPage.openingText').replace('{date}', formatLongDate(contacts.openingDate, language))}
              </p>
              <p className="text-text-secondary text-sm">{t('contactsPage.openingNote')}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {address && (
              <Card title={t('contactsPage.address')}>
                <p className="text-text-secondary mb-3">{address}</p>
                {contacts.mapUrl && (
                  <a href={contacts.mapUrl} target="_blank" rel="noopener noreferrer" className="text-orange-accent hover:underline font-semibold">
                    {t('contactsPage.openMap')} →{newTab}
                  </a>
                )}
              </Card>
            )}

            <Card title={t('contactsPage.hours')}>
              <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-1 text-sm">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const h = hoursByDay.get(day);
                  return (
                    <div key={day} className="contents">
                      <dt className="text-text-secondary">{t(`days.d${day}`)}</dt>
                      <dd className="text-text-primary">{h ? `${h.opens}–${h.closes}` : t('contactsPage.closed')}</dd>
                    </div>
                  );
                })}
              </dl>
              <p className="text-xs text-text-secondary mt-3">{t('contactsPage.hoursNote')}</p>
            </Card>

            <Card title={t('contactsPage.phone')}>
              <a href={phoneHref(contacts.phone)} className="text-xl md:text-2xl font-bold text-orange-accent hover:underline">
                {contacts.phone}
              </a>
            </Card>

            <Card title={t('contactsPage.whatsapp')}>
              <a
                href={`https://wa.me/${contacts.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl md:text-2xl font-bold text-orange-accent hover:underline"
              >
                +{contacts.whatsapp}
                {newTab}
              </a>
            </Card>

            <Card title={t('contactsPage.email')}>
              <a href={`mailto:${contacts.email}`} className="text-lg text-orange-accent hover:underline break-all">
                {contacts.email}
              </a>
            </Card>

            {contacts.instagram && (
              <Card title={t('contactsPage.instagram')}>
                <a
                  href={`https://instagram.com/${contacts.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg text-orange-accent hover:underline"
                >
                  @{contacts.instagram}
                  {newTab}
                </a>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 md:mt-12">
            <Link href="/book" className="card p-6 md:p-8 text-center hover:border-orange-accent">
              <h2 className="text-lg font-bold text-text-primary mb-2">{t('contactsPage.bookTitle')}</h2>
              <p className="text-sm text-text-secondary mb-4">{t('contactsPage.bookText')}</p>
              <span className="text-orange-accent font-semibold">{t('contactsPage.go')} →</span>
            </Link>
            <Link href="/studio-tour" className="card p-6 md:p-8 text-center hover:border-orange-accent">
              <h2 className="text-lg font-bold text-text-primary mb-2">{t('contactsPage.tourTitle')}</h2>
              <p className="text-sm text-text-secondary mb-4">{t('contactsPage.tourText')}</p>
              <span className="text-orange-accent font-semibold">{t('contactsPage.go')} →</span>
            </Link>
            <a
              href={`https://wa.me/${contacts.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-6 md:p-8 text-center hover:border-orange-accent"
            >
              <h2 className="text-lg font-bold text-text-primary mb-2">{t('contactsPage.waTitle')}</h2>
              <p className="text-sm text-text-secondary mb-4">{t('contactsPage.waText')}</p>
              <span className="text-orange-accent font-semibold">
                {t('contactsPage.go')} →{newTab}
              </span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
