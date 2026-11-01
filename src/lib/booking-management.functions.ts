import { createServerFn } from '@tanstack/react-start';
import { managementInputSchema, type ManagedBooking } from './booking-policy';

export const manageBooking = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => managementInputSchema.parse(input))
  .handler(async ({ data }) => {
    // The unguessable capability authorizes only this reservation; GET never mutates it.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: result, error } = await supabaseAdmin.rpc('manage_customer_booking', { _token: data.token, _action: data.action, _time: data.time, _people: data.people });
    if (error) throw new Error('Link non valido, scaduto o prenotazione non più disponibile. Contatta il ristorante.');
    const value = result as ManagedBooking & { event_id?: string; restaurant_id?: string };
    let emailSent: boolean | undefined;
    if (value.event_id && value.restaurant_id) {
      try { const { sendCustomerEventNotification } = await import('./service-communications.server'); emailSent = (await sendCustomerEventNotification(value.restaurant_id, value.event_id)).sent; }
      catch { emailSent = false; }
    }
    return { restaurant: value.restaurant, date: value.date, time: value.time, shift: value.shift, people: value.people, confirmation_status: value.confirmation_status, change_request: value.change_request, emailSent };
  });