import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RuleError } from '@/lib/admin/errors';
import { changeBookingStatus } from '@/lib/admin/bookings';
import { createLead, ensureLeadForBooking, moveLead, updateLead } from '@/lib/admin/leads';
import { changeTourStatus } from '@/lib/admin/tours';
import type { SessionUser } from '@/lib/auth/service';
import { SETTING_KEYS } from '@/lib/settings-schema';
import { useFakeIntegrationEnv } from '../support/api';
import { db, resetCatalog, truncateAll } from '../support/db';
import { makeStaff, publicBooking, publicTour } from '../support/fixtures';

let manager: SessionUser;
beforeAll(async () => {
  useFakeIntegrationEnv();
  await resetCatalog();
});
beforeEach(async () => {
  await truncateAll();
  manager = await makeStaff('MANAGER');
});

describe('leads', () => {
  it('3. creates a lead manually and moves it through the pipeline, logging each step', async () => {
    const lead = await createLead(db, manager, { name: 'Асель', phone: '8 701 555 44 33', source: 'instagram', expectedAmount: '40000', title: 'Подкаст о дизайне' });
    expect(lead.status).toBe('NEW');
    for (const status of ['CONTACTED', 'TOUR_SCHEDULED', 'OFFER_SENT'] as const) await moveLead(db, manager, { leadId: lead.id, status });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('OFFER_SENT');
    expect(await db.activityLog.count({ where: { entityId: lead.id, action: 'lead.status' } })).toBe(3);
    await updateLead(db, manager, { leadId: lead.id, nextContactAt: '2026-12-01T10:00', notes: 'Перезвонить' });
    const updated = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(updated.nextContactAt?.toISOString()).toBe('2026-12-01T05:00:00.000Z');
  });

  it('reuses an existing client with the same phone instead of creating a duplicate', async () => {
    await createLead(db, manager, { name: 'Первый', phone: '+7 701 555 44 33' });
    await createLead(db, manager, { name: 'Другое имя', phone: '87015554433' });
    expect(await db.client.count()).toBe(1);
    expect(await db.lead.count()).toBe(2);
  });

  it('4. LOST requires a reason', async () => {
    const lead = await createLead(db, manager, { name: 'Бекзат', phone: '+7 702 000 00 01' });
    await expect(moveLead(db, manager, { leadId: lead.id, status: 'LOST' })).rejects.toThrow(RuleError);
    await expect(moveLead(db, manager, { leadId: lead.id, status: 'LOST', lostReason: 'x' })).rejects.toThrow(RuleError);
    await moveLead(db, manager, { leadId: lead.id, status: 'LOST', lostReason: 'Дорого' });
    expect(await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ status: 'LOST', lostReason: 'Дорого' });
  });

  it('5. WON creates no duplicate client or booking and repeating it is a no-op', async () => {
    const booking = await publicBooking();
    const lead = await db.$transaction((tx) => ensureLeadForBooking(tx, booking));
    const before = { clients: await db.client.count(), bookings: await db.booking.count() };
    await moveLead(db, manager, { leadId: lead.id, status: 'WON' });
    await moveLead(db, manager, { leadId: lead.id, status: 'WON' });
    expect({ clients: await db.client.count(), bookings: await db.booking.count() }).toEqual(before);
    expect(await db.activityLog.count({ where: { entityId: lead.id, action: 'lead.status' } })).toBe(1);
    // Linking the same booking again returns the same lead.
    const again = await db.$transaction((tx) => ensureLeadForBooking(tx, booking));
    expect(again.id).toBe(lead.id);
    expect(await db.lead.count()).toBe(1);
  });

  it('a new tour request creates exactly one lead; confirming the tour moves it to TOUR_SCHEDULED', async () => {
    const tour = await publicTour();
    const lead = await db.lead.findUniqueOrThrow({ where: { tourRequestId: tour.id } });
    expect(lead).toMatchObject({ status: 'NEW', source: 'website-tour', clientId: tour.clientId });
    await changeTourStatus(db, manager, { tourId: tour.id, status: 'CONFIRMED' });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('TOUR_SCHEDULED');
    // The client's later booking attaches to the same open lead; confirming the booking wins it.
    const booking = await publicBooking({ phone: '+7 701 000 00 02' });
    const linked = await db.$transaction((tx) => ensureLeadForBooking(tx, booking));
    expect(linked.id).toBe(lead.id);
    await changeBookingStatus(db, manager, { bookingId: booking.id, status: 'CONFIRMED' });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('WON');
    expect(await db.lead.count()).toBe(1);
  });

  it('optionally creates leads for public booking requests', async () => {
    await publicBooking();
    expect(await db.lead.count()).toBe(0);
    await db.setting.create({ data: { key: SETTING_KEYS.crmOptions, value: { autoLeadFromBooking: true } } });
    const booking = await publicBooking({ time: '16:00', phone: '+7 703 000 00 03' });
    expect((await db.lead.findUniqueOrThrow({ where: { bookingId: booking.id } })).source).toBe('website-booking');
  });
});
