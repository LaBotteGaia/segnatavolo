import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { aiSettingsSchema, normalizeVoiceBooking, type VoiceBooking } from './voice-ai';

const idInput = z.object({ id: z.string().uuid() });
const aad = (id: string) => `ai:${id}`;

export const getAiSettings = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => idInput.parse(v)).handler(async ({ data, context }) => {
  const { data: allowed } = await context.supabase.rpc('can_use_restaurant', { _rid: data.id });
  if (!allowed) throw new Error('Non autorizzato');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: row } = await supabaseAdmin.from('restaurant_ai_settings').select('enabled,provider,encrypted_key').eq('restaurant_id', data.id).maybeSingle();
  const keySaved = !!row?.encrypted_key;
  return { enabled: !!row?.enabled, provider: (row?.provider ?? 'openai') as 'openai' | 'gemini', keySaved, ready: !!row?.enabled && keySaved };
});

export const saveAiSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => idInput.extend({ settings: aiSettingsSchema, key: z.string().max(500) }).parse(v)).handler(async ({ data, context }) => {
  const { data: allowed } = await context.supabase.rpc('can_configure_delivery', { _rid: data.id });
  if (!allowed) throw new Error('Non autorizzato');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { encryptPassword } = await import('./restaurant-email.server');
  const key = data.key.trim();
  const extra = key ? { encrypted_key: await encryptPassword(key, aad(data.id)) } : {};
  const { error } = await supabaseAdmin.from('restaurant_ai_settings').upsert({ restaurant_id: data.id, ...data.settings, updated_at: new Date().toISOString(), ...extra });
  if (error) throw new Error('Impostazioni IA non salvate');
  return { ok: true };
});

async function loadKey(id: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: row } = await supabaseAdmin.from('restaurant_ai_settings').select('enabled,provider,encrypted_key').eq('restaurant_id', id).maybeSingle();
  if (!row?.encrypted_key) return null;
  const { decryptPassword } = await import('./restaurant-email.server');
  return { enabled: row.enabled, provider: row.provider as 'openai' | 'gemini', key: await decryptPassword(row.encrypted_key, aad(id)) };
}

export const testAiKey = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => idInput.extend({ provider: z.enum(['openai', 'gemini']), key: z.string().max(500) }).parse(v)).handler(async ({ data, context }) => {
  const { data: allowed } = await context.supabase.rpc('can_configure_delivery', { _rid: data.id });
  if (!allowed) throw new Error('Non autorizzato');
  const key = data.key.trim() || (await loadKey(data.id))?.key;
  if (!key) return { ok: false, message: 'Inserisci una chiave API.' };
  const { callProvider } = await import('./voice-ai.server');
  const r = await callProvider(data.provider, key, 'Tavolo per 2 oggi alle 20:00 a nome Prova', new Date().toISOString().slice(0, 10), 60);
  return r.ok ? { ok: true, message: 'Chiave API valida e pronta all’uso' } : { ok: false, message: r.message };
});

export const parseVoiceBooking = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ restaurant_id: z.string().uuid(), transcript: z.string().trim().min(3).max(1000), current_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(v)).handler(async ({ data, context }): Promise<{ ok: true; booking: VoiceBooking } | { ok: false; message: string }> => {
  const { data: allowed } = await context.supabase.rpc('can_use_restaurant', { _rid: data.restaurant_id });
  if (!allowed) throw new Error('Non autorizzato');
  const cfg = await loadKey(data.restaurant_id);
  if (!cfg || !cfg.enabled) return { ok: false, message: 'Dettatura vocale non configurata per questo ristorante.' };
  const { callProvider } = await import('./voice-ai.server');
  const r = await callProvider(cfg.provider, cfg.key, data.transcript, data.current_date);
  if (!r.ok) return r;
  try { return { ok: true, booking: normalizeVoiceBooking(JSON.parse(r.text), data.current_date) }; }
  catch { return { ok: false, message: 'Risposta dell’IA non interpretabile: correggi il testo e riprova.' }; }
});
