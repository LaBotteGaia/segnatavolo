import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const decideOnlineBooking = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ restaurantId: z.string().uuid(), id: z.string().uuid(), accept: z.boolean(), tables: z.array(z.string().uuid()), extras: z.object({ extra_sponde: z.number().int().min(0).max(20), extra_barelle: z.number().int().min(0).max(20), barella_seats: z.number().int().min(0).max(20) }), reason: z.string().max(1000) }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('decide_online_booking', { _restaurant_id: data.restaurantId, _id: data.id, _accept: data.accept, _tables: data.tables, _extras: data.extras, _reason: data.reason });
    if (error) return { ok: false as const, error: error.code === 'P0001' ? error.message : 'Richiesta non aggiornata. Riprova.' };
    return { ok: true as const, result };
  });