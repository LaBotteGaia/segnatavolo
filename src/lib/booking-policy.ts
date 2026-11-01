import { z } from 'zod';

export const WEEKDAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'] as const;
export const bookingPolicySchema = z.object({
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat('it', { timeZone: value }); return true; } catch { return false; } }, 'Fuso orario non valido').default('Europe/Rome'),
  custom_intro_text: z.string().max(5000).default(''),
  booking_window_days: z.number().int().min(1).max(365).default(30),
  allow_same_day_online: z.boolean().default(false),
  contact_phone: z.string().max(40).default(''),
  contact_whatsapp: z.string().max(40).default(''),
  enable_double_shift: z.boolean().default(false),
  double_shift_days: z.array(z.enum(WEEKDAYS)).default([]),
  first_shift_duration_minutes: z.number().int().min(15).max(480).default(90),
  no_show_tolerance_minutes: z.number().int().min(0).max(120).default(15),
  morning_reminder_enabled: z.boolean().default(true),
  online_turns_override: z.boolean().default(false),
});
export type BookingPolicy = z.infer<typeof bookingPolicySchema>;
export const DEFAULT_BOOKING_POLICY = bookingPolicySchema.parse({});

export function localClock(now: Date, timezone = 'Europe/Rome') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, minutes: Number(value('hour')) * 60 + Number(value('minute')) };
}

export function bookingDateAllowed(date: string, today: string, policy: BookingPolicy) {
  const distance = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  return distance >= (policy.allow_same_day_online ? 0 : 1) && distance <= policy.booking_window_days;
}

export function reconfirmationBadge(row: { date: string; time: string; channel: string; status: string; arrived: boolean; confirmation_status?: string; delay_notified?: boolean }, now: Date, policy: BookingPolicy) {
  const clock = localClock(now, policy.timezone);
  if (row.channel !== 'online' || row.status !== 'confirmed' || row.arrived || row.date !== clock.date) return null;
  const booked = /^\d{2}:\d{2}$/.test(row.time) ? Number(row.time.slice(0, 2)) * 60 + Number(row.time.slice(3)) : Infinity;
  if (!row.delay_notified && clock.minutes - booked > policy.no_show_tolerance_minutes) return { urgent: true, label: `Ritardo oltre ${policy.no_show_tolerance_minutes} min` };
  if (row.confirmation_status === 'riconfermata') return { urgent: false, label: 'Riconfermata' };
  return policy.morning_reminder_enabled ? { urgent: false, label: 'Da riconfermare' } : null;
}

export const managementInputSchema = z.object({ token: z.string().uuid(), action: z.enum(['view', 'confirm', 'cancel', 'request_change']), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), shift: z.enum(['pranzo','sera']).optional(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), people: z.number().int().min(1).max(100).optional() }).superRefine((v, ctx) => {
  if (v.action === 'request_change' && (v.time === undefined || v.people === undefined)) ctx.addIssue({ code: 'custom', message: 'Inserisci orario e coperti' });
});
export type ManagedBooking = { restaurant: string; date: string; time: string; shift: string; people: number; confirmation_status: string; slug?: string | null; modification_status?: string; modification_reason?: string; change_request?: { date?: string; shift?: string; time: string; people: number } | null };