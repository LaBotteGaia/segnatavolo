import { z } from 'zod';
import { dayNames, resolveVoiceDate, voiceDateSchema, type VoiceDateContext } from './voice-date';

export const AI_PROVIDERS = { openai: 'OpenAI (GPT-4o-mini)', gemini: 'Google Gemini (Gemini Flash)' } as const;
export type AiProvider = keyof typeof AI_PROVIDERS;
export const aiSettingsSchema = z.object({ enabled: z.boolean().default(false), provider: z.enum(['openai', 'gemini']).default('openai') });

export type VoiceBooking = { customer_name: string | null; phone: string | null; pax: number; date: string; time: string; notes: string; is_outdoor: boolean };

export function voicePrompt(currentDate: string, context?: VoiceDateContext) {
  const weekday = context?.current_day_name ?? dayNames[new Date(`${currentDate}T12:00:00Z`).getUTCDay()];
  return `Sei l'assistente di un ristorante italiano. Estrai i dati di una prenotazione dalla frase dettata da un operatore.
CONTESTO TEMPORALE DI RIFERIMENTO:
- Oggi è: ${weekday}, data: ${currentDate} (AAAA-MM-GG, calendario locale del dispositivo).
- Data visualizzata nell'agenda: ${context?.agenda_selected_date ?? 'non disponibile'}.
REGOLE DI CALCOLO RIGOROSE PER date:
1. Oggi, stasera, a pranzo/cena senza altra data: usa esattamente ${currentDate}.
2. Domani / domani sera: aggiungi esattamente 1 giorno a ${currentDate}.
3. Dopodomani: aggiungi esattamente 2 giorni.
4. Giorni della settimana (sabato, questo sabato, venerdì prossimo): prima occorrenza strettamente successiva a oggi, anche se oggi è quel giorno.
5. Giorni numerici (il 25, per il 28): mese corrente, oppure il successivo se già trascorsi; usa solo date di calendario valide.
6. Per questo giorno / per la data a schermo: usa la data dell'agenda se disponibile.
7. Nessun riferimento temporale (es. Tavolo per 4 a nome Rossi alle 20:30): usa la data dell'agenda, oppure oggi.
date DEVE essere una data reale in formato YYYY-MM-DD. Non confondere coperti, telefono e orario con giorni numerici.
"Sera"/"cena" senza ora = 20:00; "pranzo" senza ora = 13:00. Rispondi SOLO con un oggetto JSON con esattamente queste chiavi: {"customer_name": string|null, "phone": string|null (solo cifre e +), "pax": number, "date": "YYYY-MM-DD", "time": "HH:MM", "notes": string (allergie, intolleranze, richieste; stringa vuota se nessuna), "is_outdoor": boolean (true solo se chiede esterno/dehors/fuori)}.`;
}

const raw = z.object({
  customer_name: z.string().nullable().optional(), phone: z.union([z.string(), z.number()]).nullable().optional(), pax: z.coerce.number().optional(),
  date: z.string().optional(), time: z.string().optional(), notes: z.string().nullable().optional(), is_outdoor: z.boolean().optional(),
});

/** Normalizza la risposta dell'IA in valori sicuri per il modulo prenotazione. */
export function normalizeVoiceBooking(input: unknown, currentDate: string, context?: VoiceDateContext, transcript?: string): VoiceBooking {
  const r = raw.parse(input);
  const pax = Math.round(r.pax ?? 2);
  const tm = /^(\d{1,2})[:.](\d{2})$/.exec(r.time?.trim() ?? '');
  let time = '';
  if (tm && Number(tm[1]) < 24 && Number(tm[2]) < 60) {
    const total = Math.round((Number(tm[1]) * 60 + Number(tm[2])) / 15) * 15;
    time = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  const phone = r.phone == null ? null : String(r.phone).replace(/[^\d+]/g, '') || null;
  const resolved = context && transcript != null ? resolveVoiceDate(transcript, context) : null;
  const parsedDate = voiceDateSchema.safeParse(r.date);
  return {
    customer_name: r.customer_name?.trim() || null, phone,
    pax: pax >= 1 && pax <= 200 ? pax : 2,
    date: resolved ?? (parsedDate.success ? parsedDate.data : context?.agenda_selected_date || currentDate),
    time, notes: (r.notes ?? '').trim().slice(0, 500), is_outdoor: !!r.is_outdoor,
  };
}

export function providerError(status: number, body: unknown) {
  const msg = (body as { error?: { message?: string } } | null)?.error?.message;
  return msg ? msg.slice(0, 300) : `Errore del provider (HTTP ${status})`;
}
