import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { MASTER_ONLY_MESSAGE } from './assignment-rules';

const idInput = z.object({ id: z.string().uuid() });
const settingsSchema = z.object({
  enabled: z.boolean(),
  phone_number_id: z.string().trim().regex(/^\d{5,30}$/, 'Phone Number ID non valido').or(z.literal('')),
  display_phone: z.string().trim().max(30),
  template_name: z.string().trim().regex(/^[a-z0-9_]{0,512}$/, 'Nome modello: solo minuscole, numeri e _'),
  template_language: z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/, 'Lingua non valida'),
});

async function requireMaster(supabase: { rpc: (n: 'can_configure_delivery', a: { _rid: string }) => PromiseLike<{ data: unknown; error: unknown }> }, id: string) {
  const { data, error } = await supabase.rpc('can_configure_delivery', { _rid: id });
  if (error || !data) throw new Error(MASTER_ONLY_MESSAGE);
}

/** Stato visibile a tutto il personale del ristorante (mai il token). */
export const getWhatsAppStatus = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => idInput.parse(v)).handler(async ({ data, context }) => {
  const { data: allowed } = await context.supabase.rpc('can_use_restaurant', { _rid: data.id });
  if (!allowed) throw new Error('Non autorizzato');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: row } = await supabaseAdmin.from('restaurant_whatsapp_settings').select('enabled,phone_number_id,display_phone,template_name,template_language,encrypted_token,updated_at').eq('restaurant_id', data.id).maybeSingle();
  const tokenSaved = !!row?.encrypted_token;
  return {
    enabled: !!row?.enabled, phone_number_id: row?.phone_number_id ?? '', display_phone: row?.display_phone ?? '',
    template_name: row?.template_name ?? '', template_language: row?.template_language ?? 'it', tokenSaved,
    ready: !!row?.enabled && tokenSaved && !!row?.phone_number_id, updated_at: row?.updated_at ?? null,
  };
});

export const saveWhatsAppSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => idInput.extend({ settings: settingsSchema, token: z.string().max(1000), clearToken: z.boolean().default(false) }).parse(v)).handler(async ({ data, context }) => {
  await requireMaster(context.supabase, data.id);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { encryptPassword } = await import('./restaurant-email.server');
  const { whatsappAad } = await import('./whatsapp.server');
  const token = data.token.trim();
  const extra = data.clearToken ? { encrypted_token: null } : token ? { encrypted_token: await encryptPassword(token, whatsappAad(data.id)) } : {};
  const s = data.settings;
  const { error } = await supabaseAdmin.from('restaurant_whatsapp_settings').upsert({
    restaurant_id: data.id, enabled: s.enabled && !data.clearToken, phone_number_id: s.phone_number_id || null, display_phone: s.display_phone || null,
    template_name: s.template_name || null, template_language: s.template_language, updated_at: new Date().toISOString(), updated_by: context.userId, ...extra,
  });
  if (error) throw new Error('Impostazioni WhatsApp non salvate');
  return { ok: true };
});

export const testWhatsApp = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => idInput.extend({ to: z.string().trim().min(6).max(30), phone_number_id: z.string().trim().max(30), token: z.string().max(1000) }).parse(v)).handler(async ({ data, context }) => {
  await requireMaster(context.supabase, data.id);
  const { loadWhatsAppConfig, sendWhatsApp } = await import('./whatsapp.server');
  const saved = await loadWhatsAppConfig(data.id);
  const phoneNumberId = data.phone_number_id || saved?.phoneNumberId;
  const token = data.token.trim() || saved?.token;
  if (!phoneNumberId || !token) return { ok: false, message: 'Inserisci Phone Number ID e token di accesso.' };
  // hello_world è il modello di prova predefinito di Meta: funziona anche fuori dalla finestra di 24 ore.
  const r = await sendWhatsApp({ phoneNumberId, token }, data.to, { type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } } });
  return r.ok ? { ok: true, message: 'Messaggio di prova accettato da Meta. Controlla il telefono.' } : { ok: false, message: r.message };
});
