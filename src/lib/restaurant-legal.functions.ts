import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { slugSchema } from './online-booking';
import type { RestaurantLegal } from './restaurant-legal';

function publicClient() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  return createClient<Database>(process.env['SUPABASE_URL']!, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith('sb_')) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h }); } } });
}

export const getRestaurantLegal = createServerFn({ method: 'GET' }).inputValidator((d: unknown) => z.object({ slug: slugSchema }).parse(d)).handler(async ({ data }) => {
  const { data: legal, error } = await publicClient().rpc('get_restaurant_legal', { _slug: data.slug });
  if (error) throw new Error('Informativa non disponibile. Riprova.');
  return legal as RestaurantLegal | null;
});

export const listPublicRestaurants = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await publicClient().rpc('list_public_restaurants');
  if (error) throw new Error('Elenco ristoranti non disponibile.');
  return (data ?? []).map(r => ({ slug: r.slug, name: r.name }));
});
