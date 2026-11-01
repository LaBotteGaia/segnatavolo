import { describe, expect, it } from 'vitest';
import { unconfirmedWithinHour, dailySummary } from '@/lib/service-communications';
import { bookingContacts, contactOverrideSchema } from '@/lib/restaurant-identity';
import { managementInputSchema } from '@/lib/booking-policy';
const booking = { channel: 'online', status: 'confirmed', arrived: false, confirmation_status: 'in_attesa_riconferma', date: '2026-11-02', time: '12:00' };
const contacts = { main_email: 'main@example.com', main_phone: '111', main_whatsapp: '222', booking_email_override: false, booking_email: 'booking@example.com', booking_phone_override: false, contact_phone: '333', contact_whatsapp: '444' };
describe('regole di comunicazione del servizio', () => {
  it('mostra l’alert esattamente a 60 minuti nel fuso Europe/Rome', () => { expect(unconfirmedWithinHour(booking, new Date('2026-11-02T10:00:00Z'))).toBe(true); expect(unconfirmedWithinHour(booking, new Date('2026-11-02T09:59:00Z'))).toBe(false); });
  it('non avvisa per prenotazioni già riconfermate', () => { expect(unconfirmedWithinHour({ ...booking, confirmation_status: 'riconfermata' }, new Date('2026-11-02T10:30:00Z'))).toBe(false); });
  it('non avvisa per prenotazioni cancellate o arrivate', () => { expect(unconfirmedWithinHour({ ...booking, deleted_at: '2026-11-02' }, new Date('2026-11-02T10:30:00Z'))).toBe(false); expect(unconfirmedWithinHour({ ...booking, arrived: true }, new Date('2026-11-02T10:30:00Z'))).toBe(false); });
  it('eredita i recapiti principali quando gli override sono spenti', () => { expect(bookingContacts(contacts)).toEqual({ email: 'main@example.com', phone: '111', whatsapp: '222' }); });
  it('usa i recapiti dedicati soltanto con gli interruttori attivi', () => { expect(bookingContacts({ ...contacts, booking_email_override: true, booking_phone_override: true })).toEqual({ email: 'booking@example.com', phone: '333', whatsapp: '444' }); });
  it('rende obbligatoria l’email quando il recapito dedicato è attivo', () => { expect(contactOverrideSchema.safeParse({ ...contacts, booking_email_override: true, booking_email: '' }).success).toBe(false); });
  it('rende obbligatorio almeno un telefono dedicato quando attivo', () => { expect(contactOverrideSchema.safeParse({ ...contacts, booking_phone_override: true, contact_phone: '', contact_whatsapp: '' }).success).toBe(false); });
  it('una richiesta modifica richiede orario valido e coperti', () => { const token = '123e4567-e89b-42d3-a456-426614174000'; expect(managementInputSchema.safeParse({ token, action: 'request_change', time: '25:00', people: 2 }).success).toBe(false); expect(managementInputSchema.safeParse({ token, action: 'request_change', time: '12:30' }).success).toBe(false); expect(managementInputSchema.safeParse({ token, action: 'request_change', time: '12:30', people: 4 }).success).toBe(true); });
  it('riepilogo ordina per orario e somma coperti per servizio con note cliente', () => {
    const rows = [{ time: '20:00', name: 'Cena', people: 4, shift: 'sera', channel: 'online', notes: '', table_ids: [] }, { time: '12:00', name: 'Pranzo', people: 2, shift: 'pranzo', channel: 'internal', notes: 'allergia latte', table_ids: [] }];
    const result = dailySummary(rows, [], []); expect(result.indexOf('12:00 |')).toBeLessThan(result.indexOf('20:00 |')); expect(result).toContain('Pranzo: 1 prenotazioni · 2 coperti'); expect(result).toContain('Cena: 1 prenotazioni · 4 coperti'); expect(result).toContain('allergia latte');
  });
});