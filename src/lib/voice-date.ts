import { addDays, addMonths, format, getDay, isValid, parseISO } from 'date-fns';
import { z } from 'zod';

export const dayNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'] as const;
export const voiceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = parseISO(s);
  return isValid(d) && format(d, 'yyyy-MM-dd') === s;
}, 'Data non valida');
export type VoiceDateContext = { current_date: string; current_day_name: string; agenda_selected_date?: string | null };

/** Use local calendar fields, never the UTC date from toISOString(). */
export function voiceDateContext(now: Date, selectedDate?: string | null): VoiceDateContext {
  return { current_date: format(now, 'yyyy-MM-dd'), current_day_name: dayNames[now.getDay()] ?? 'domenica', agenda_selected_date: selectedDate ?? null };
}

/** Deterministic rules override model arithmetic; complex explicit dates stay with the model. */
export function resolveVoiceDate(transcript: string, ctx: VoiceDateContext): string | null {
  const text = transcript.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const today = parseISO(ctx.current_date);
  const iso = (d: Date) => format(d, 'yyyy-MM-dd');
  if (/\b(questo giorno|questa data|data (?:a|sullo) schermo|giorno (?:a|sullo) schermo|data dell.agenda)\b/.test(text)) return ctx.agenda_selected_date || ctx.current_date;
  if (/\bdopodomani\b/.test(text)) return iso(addDays(today, 2));
  if (/\bdomani\b/.test(text)) return iso(addDays(today, 1));
  // A fully qualified date or month must not be mistaken for a bare day number.
  if (/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}\b|\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/.test(text)) return null;
  const names = dayNames.map((d) => d.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const weekday = names.findIndex((d) => new RegExp(`\\b${d}\\b`).test(text));
  if (weekday >= 0) return iso(addDays(today, (weekday - getDay(today) + 7) % 7 || 7));
  const numeric = /\bil\s+(\d{1,2})\b/.exec(text);
  if (numeric) {
    const day = Number(numeric[1]);
    if (day < 1 || day > 31) return null;
    for (let offset = 0; offset < 12; offset++) {
      const month = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), offset);
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      if (date.getMonth() === month.getMonth() && iso(date) >= ctx.current_date) return iso(date);
    }
    return null;
  }
  if (/\b(oggi|stasera|stanotte)\b|\b(?:a|per|al|alla)\s+(?:il\s+|la\s+)?(?:pranzo|cena)\b/.test(text)) return ctx.current_date;
  // Other explicit temporal expressions are interpreted by the model, not silently defaulted.
  if (/\b(ieri|settimana|mese|anno|prossim[oa]|fra|tra|giorni|giorno|data|sera|mattina|pomeriggio)\b/.test(text)) return null;
  return ctx.agenda_selected_date || ctx.current_date;
}