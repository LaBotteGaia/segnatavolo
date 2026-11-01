import { z } from 'zod';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v; }, 'Data non valida');
export const scheduleExceptionSchema = z.object({ id: z.string().uuid(), exception_type: z.enum(['chiusura_straordinaria', 'apertura_straordinaria']), start_date: date, end_date: date, applies_to: z.enum(['tutto_il_giorno', 'solo_pranzo', 'solo_cena']), reason: z.string().trim().max(500).default('') }).refine(e => e.start_date <= e.end_date, 'La fine deve essere successiva o uguale all’inizio');
export type ScheduleException = z.infer<typeof scheduleExceptionSchema>;
export const scheduleExceptionsSchema = z.array(scheduleExceptionSchema).max(100);
export function exceptionsOf(raw: unknown): ScheduleException[] { const parsed = scheduleExceptionsSchema.safeParse(raw); return parsed.success ? parsed.data : []; }
export function exceptionState(raw: unknown, date: string, shift: string): 'closed' | 'open' | null {
  const list = exceptionsOf(raw).filter(e => e.start_date <= date && date <= e.end_date && (e.applies_to === 'tutto_il_giorno' || e.applies_to === (shift === 'pranzo' ? 'solo_pranzo' : shift === 'sera' ? 'solo_cena' : '')));
  return list.some(e => e.exception_type === 'chiusura_straordinaria') ? 'closed' : list.length ? 'open' : null;
}
export function closureMessage(raw: unknown, date: string, shift?: string) {
  return exceptionsOf(raw).filter(e => e.exception_type === 'chiusura_straordinaria' && e.start_date <= date && date <= e.end_date && (!shift || e.applies_to === 'tutto_il_giorno' || e.applies_to === (shift === 'pranzo' ? 'solo_pranzo' : 'solo_cena'))).map(e => `${e.applies_to === 'solo_pranzo' ? 'Pranzo' : e.applies_to === 'solo_cena' ? 'Cena' : 'Locale'} chiuso${e.reason ? `: ${e.reason}` : ''}${e.start_date !== e.end_date ? ` fino al ${e.end_date.split('-').reverse().join('/')}` : ` il ${e.start_date.split('-').reverse().join('/')}`}`).join(' · ');
}