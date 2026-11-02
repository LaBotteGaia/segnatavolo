import { z } from 'zod';
import { sendRestaurantMessage } from './restaurant-email.server';
import { emailSettingsSchema, interpolateEmail } from './restaurant-email';

const reminderSchema = z.object({ id: z.string().uuid(), restaurant_id: z.string().uuid(), restaurant: z.string(), email: z.string().email(), date: z.string(), time: z.string(), shift: z.string(), people: z.number(), token: z.string().uuid(), whatsapp: z.string() });

export async function sendNextMorningReminder() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  // Claim one recipient atomically: never loop over customer lists or alter booking templates.
  const { data, error } = await supabaseAdmin.rpc('claim_morning_reminder');
  if (error) throw new Error('Promemoria non disponibile');
  if (!data) return { processed: false };
  const booking = reminderSchema.parse(data);
  const [{data:reservation,error:reservationError},{data:delivery,error:deliveryError}] = await Promise.all([
    supabaseAdmin.from('reservations').select('name,phone,notes').eq('id',booking.id).eq('restaurant_id',booking.restaurant_id).single(),
    supabaseAdmin.from('restaurant_delivery_settings').select('settings').eq('restaurant_id',booking.restaurant_id).maybeSingle(),
  ]);
  if(reservationError || deliveryError || !reservation) throw new Error('Dati promemoria non disponibili');
  const template = emailSettingsSchema.parse(delivery?.settings ?? {}).templates.reminder;
  const vars = {nome_cliente:reservation.name,telefono_cliente:reservation.phone ?? '',email_cliente:booking.email,data:booking.date.split('-').reverse().join('/'),ora:booking.time,pax:String(booking.people),nome_ristorante:booking.restaurant,telefono_ristorante:booking.whatsapp,note_cliente:reservation.notes ?? ''};
  const url = `https://segnatavolo.lovable.app/prenotazione/${booking.token}`;
  const subject = interpolateEmail(template.subject,vars).replace(/[\r\n]/g,' ');
  const text = `${interpolateEmail(template.body,vars)}\n\nRiconferma la presenza:\n${url}\n\nPer cancellare la prenotazione, apri lo stesso link e scegli “Cancella prenotazione”.${booking.whatsapp ? `\nPuoi contattarci anche su WhatsApp al ${booking.whatsapp}.` : ''}`;
  const result = await sendRestaurantMessage(booking.restaurant_id, booking.email, subject, text);
  const { error: writeError } = await supabaseAdmin.from('reservations').update({ morning_reminder_sent_at: result.sent ? new Date().toISOString() : null, morning_reminder_error: result.sent ? null : result.message }).eq('id', booking.id).eq('restaurant_id', booking.restaurant_id);
  if (writeError) throw new Error('Esito promemoria non registrato');
  return { processed: true, sent: result.sent };
}