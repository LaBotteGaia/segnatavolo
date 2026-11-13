import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { normalizePhotoResult, photoPrompt, type PhotoResult } from './agenda-photo';

const aad = (id: string) => `ai:${id}`;

/** Legge la foto di una pagina d'agenda con la chiave IA del ristorante; nessun salvataggio. */
export const readAgendaPhoto = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ restaurant_id: z.string().uuid(), agenda_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), image: z.string().min(100).max(7_000_000) }).parse(v))
  .handler(async ({ data, context }): Promise<{ ok: true; result: PhotoResult } | { ok: false; message: string }> => {
    const { data: allowed } = await context.supabase.rpc('can_use_restaurant', { _rid: data.restaurant_id });
    if (!allowed) throw new Error('Non autorizzato');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: row } = await supabaseAdmin.from('restaurant_ai_settings').select('enabled,provider,encrypted_key').eq('restaurant_id', data.restaurant_id).maybeSingle();
    if (!row?.encrypted_key || !row.enabled) return { ok: false, message: 'Lettura IA non configurata: il Master deve attivarla in Impostazioni → Integrazioni.' };
    const { decryptPassword } = await import('./restaurant-email.server');
    const key = await decryptPassword(row.encrypted_key, aad(data.restaurant_id));
    const { callVisionProvider } = await import('./voice-ai.server');
    const r = await callVisionProvider(row.provider as 'openai' | 'gemini', key, photoPrompt(data.agenda_date), data.mime, data.image);
    if (!r.ok) return r;
    try { return { ok: true, result: normalizePhotoResult(JSON.parse(r.text.replace(/^```(?:json)?|```$/g, '').trim())) }; }
    catch (e) { console.error('agenda photo parse', (e as Error).message); return { ok: false, message: 'La foto non è stata interpretata: riprova con più luce e la pagina intera inquadrata.' }; }
  });
