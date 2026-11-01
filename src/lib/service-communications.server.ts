import { z } from 'zod';
import { bookingContacts } from './restaurant-identity';
import { dailySummary } from './service-communications';
import { sendRestaurantMessage } from './restaurant-email.server';

export async function sendCustomerEventNotification(restaurantId: string, eventId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const [{ data: event, error }, { data: venue }] = await Promise.all([
    supabaseAdmin.from('service_notifications').select('kind,message').eq('id', eventId).eq('restaurant_id', restaurantId).single(),
    supabaseAdmin.from('restaurants').select('*').eq('id', restaurantId).single(),
  ]);
  if (error || !event || !venue) return { sent: false };
  const recipient = bookingContacts(venue).email;
  if (!recipient) return { sent: false };
  return sendRestaurantMessage(restaurantId, recipient, event.kind === 'cancelled' ? 'Disdetta cliente — Tavolo liberato' : 'Richiesta modifica prenotazione', event.message);
}
const claimSchema = z.object({ restaurant_id: z.string().uuid(), name: z.string(), email: z.string().email(), date: z.string() });
export async function sendNextDailySummary() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.rpc('claim_daily_service_summary');
  if (error) throw new Error('Riepilogo non disponibile');
  if (!data) return { processed: false };
  const claim = claimSchema.parse(data);
  // Each claim is for one restaurant and one recipient, never a customer mailing list.
  try {
    const [bookings, tables, rooms, customers] = await Promise.all([
      supabaseAdmin.from('reservations').select('time,name,people,shift,channel,notes,customer_notes,table_ids,customer_id').eq('restaurant_id', claim.restaurant_id).eq('date', claim.date).eq('status', 'confirmed').is('deleted_at', null).order('time').limit(5000),
      supabaseAdmin.from('restaurant_tables').select('id,name,room_id').eq('restaurant_id', claim.restaurant_id),
      supabaseAdmin.from('rooms').select('id,name').eq('restaurant_id', claim.restaurant_id),
      supabaseAdmin.from('customers').select('id,notes').eq('restaurant_id', claim.restaurant_id).limit(5000),
    ]);
    if (bookings.error || tables.error || rooms.error || customers.error) throw new Error('Dati riepilogo non disponibili');
    const subject = `Riepilogo Prenotazioni di Oggi ${claim.date.split('-').reverse().join('/')} - Segnatavolo`;
    const result = await sendRestaurantMessage(claim.restaurant_id, claim.email, subject, `${claim.name}\n\n${dailySummary(bookings.data, tables.data, rooms.data, customers.data)}`);
    await supabaseAdmin.from('restaurants').update({ daily_summary_sent_at: result.sent ? new Date().toISOString() : null, daily_summary_error: result.sent ? null : result.message }).eq('id', claim.restaurant_id).eq('daily_summary_date', claim.date);
    return { processed: true, sent: result.sent };
  } catch {
    await supabaseAdmin.from('restaurants').update({ daily_summary_error: 'Riepilogo non inviato: controlla il servizio email.' }).eq('id', claim.restaurant_id).eq('daily_summary_date', claim.date);
    return { processed: true, sent: false };
  }
}