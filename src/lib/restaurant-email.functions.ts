import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { emailSettingsSchema } from './restaurant-email';
import { MASTER_ONLY_MESSAGE } from './assignment-rules';

export const getRestaurantEmail = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v)).handler(async ({ data, context }) => {
  const { data: allowed, error: authError } = await context.supabase.rpc('can_configure_delivery', { _rid: data.id });
  if (authError || !allowed) throw new Error(MASTER_ONLY_MESSAGE);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: row, error } = await supabaseAdmin.from('restaurant_delivery_settings').select('settings,encrypted_password').eq('restaurant_id', data.id).maybeSingle();
  if (error) throw new Error('Configurazione non disponibile');
  return { settings: emailSettingsSchema.parse(row?.settings ?? {}), passwordSaved: !!row?.encrypted_password };
});
export const saveRestaurantEmail = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ id: z.string().uuid(), settings: emailSettingsSchema, password: z.string().max(1000) }).parse(v)).handler(async ({ data, context }) => {
  const { data: allowed, error: authError } = await context.supabase.rpc('can_configure_delivery', { _rid: data.id });
  if (authError || !allowed) throw new Error(MASTER_ONLY_MESSAGE);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { encryptPassword } = await import('./restaurant-email.server');
  const encrypted = data.password ? { encrypted_password: await encryptPassword(data.password, data.id) } : {};
  const { error } = await supabaseAdmin.from('restaurant_delivery_settings').upsert({ restaurant_id: data.id, settings: data.settings, updated_at: new Date().toISOString(), ...encrypted });
  if (error) throw new Error('Configurazione non salvata');
  return { ok: true };
});
export const testRestaurantEmail = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v)).handler(async ({ data, context }) => {
  const { data: allowed, error: authError } = await context.supabase.rpc('can_configure_delivery', { _rid: data.id });
  if (authError || !allowed) throw new Error(MASTER_ONLY_MESSAGE);
  const { data: userData, error } = await context.supabase.auth.getUser();
  if (error || !userData.user?.email) return { sent: false, message: 'Email dell’operatore non disponibile.' };
  const { sendRestaurantMessage } = await import('./restaurant-email.server');
  return sendRestaurantMessage(data.id, userData.user.email, 'Prova server di posta', 'La configurazione del server di posta di Segnatavolo ha inviato questa email di prova.');
});