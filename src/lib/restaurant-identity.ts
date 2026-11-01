import { z } from 'zod';

const email = z.string().trim().email().max(255).or(z.literal(''));
export const identitySchema = z.object({
  name: z.string().trim().min(1).max(150), public_address: z.string().max(500),
  public_logo_url: z.string().url().startsWith('https://').max(1000).or(z.literal('')),
  website_url: z.string().max(500), main_email: email, main_phone: z.string().max(40), main_whatsapp: z.string().max(40), vat_number: z.string().max(40),
  timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('it', { timeZone: v }); return true; } catch { return false; } }),
});
export const contactOverrideSchema = z.object({ booking_email_override: z.boolean(), booking_email: email, booking_phone_override: z.boolean(), contact_phone: z.string().max(40), contact_whatsapp: z.string().max(40) }).superRefine((v, ctx) => {
  if (v.booking_email_override && !v.booking_email) ctx.addIssue({ code: 'custom', message: 'Inserisci l’email dedicata', path: ['booking_email'] });
  if (v.booking_phone_override && !v.contact_phone && !v.contact_whatsapp) ctx.addIssue({ code: 'custom', message: 'Inserisci almeno un recapito dedicato', path: ['contact_phone'] });
});
export function bookingContacts(v: { main_email: string; main_phone: string; main_whatsapp: string; booking_email_override: boolean; booking_email: string; booking_phone_override: boolean; contact_phone: string; contact_whatsapp: string }) {
  return { email: v.booking_email_override ? v.booking_email : v.main_email, phone: v.booking_phone_override ? v.contact_phone : v.main_phone, whatsapp: v.booking_phone_override ? v.contact_whatsapp : v.main_whatsapp };
}