import { z } from 'zod';

export const AI_PROVIDERS = { openai: 'OpenAI (GPT-4o-mini)', gemini: 'Google Gemini (Gemini Flash)' } as const;
export type AiProvider = keyof typeof AI_PROVIDERS;
export const aiSettingsSchema = z.object({ enabled: z.boolean().default(false), provider: z.enum(['openai', 'gemini']).default('openai') });

export type VoiceBooking = { customer_name: string | null; phone: string | null; pax: number; date: string; time: string; notes: string; is_outdoor: boolean };

export function voicePrompt(currentDate: string) {
  return `Sei l'assistente di un ristorante italiano. Estrai i dati di una prenotazione dalla frase dettata da un operatore. Oggi è ${currentDate} (YYYY-MM-DD, fuso Europe/Rome): risolvi "oggi", "domani", "sabato" ecc. rispetto a questa data. "Sera"/"cena" senza ora = 20:00; "pranzo" senza ora = 13:00. Rispondi SOLO con un oggetto JSON con esattamente queste chiavi: {"customer_name": string|null, "phone": string|null (solo cifre e +), "pax": number, "date": "YYYY-MM-DD", "time": "HH:MM", "notes": string (allergie, intolleranze, richieste; stringa vuota se nessuna), "is_outdoor": boolean (true solo se chiede esterno/dehors/fuori)}.`;
}

const raw = z.object({
  customer_name: z.string().nullable().optional(), phone: z.union([z.string(), z.number()]).nullable().optional(), pax: z.coerce.number().optional(),
  date: z.string().optional(), time: z.string().optional(), notes: z.string().nullable().optional(), is_outdoor: z.boolean().optional(),
});

/** Normalizza la risposta dell'IA in valori sicuri per il modulo prenotazione. */
export function normalizeVoiceBooking(input: unknown, currentDate: string): VoiceBooking {
  const r = raw.parse(input);
  const pax = Math.round(r.pax ?? 2);
  const tm = /^(\d{1,2})[:.](\d{2})$/.exec(r.time?.trim() ?? '');
  let time = '';
  if (tm && Number(tm[1]) < 24 && Number(tm[2]) < 60) {
    const total = Math.round((Number(tm[1]) * 60 + Number(tm[2])) / 15) * 15;
    time = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  const phone = r.phone == null ? null : String(r.phone).replace(/[^\d+]/g, '') || null;
  return {
    customer_name: r.customer_name?.trim() || null, phone,
    pax: pax >= 1 && pax <= 200 ? pax : 2,
    date: /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') ? r.date! : currentDate,
    time, notes: (r.notes ?? '').trim().slice(0, 500), is_outdoor: !!r.is_outdoor,
  };
}

export function providerError(status: number, body: unknown) {
  const msg = (body as { error?: { message?: string } } | null)?.error?.message;
  return msg ? msg.slice(0, 300) : `Errore del provider (HTTP ${status})`;
}
