import { createServerFn } from '@tanstack/react-start';
import { managementInputSchema, type ManagedBooking } from './booking-policy';

export const manageBooking = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => managementInputSchema.parse(input))
  .handler(async ({ data }) => {
    // The unguessable capability authorizes only this reservation; GET never mutates it.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: result, error } = await supabaseAdmin.rpc('manage_online_reservation', { _token: data.token, _action: data.action });
    if (error) throw new Error('Link non valido, scaduto o prenotazione non più disponibile. Contatta il ristorante.');
    return result as ManagedBooking;
  });