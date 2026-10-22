import { describe, expect, it } from 'vitest';
import { normalizeVoiceBooking } from '@/lib/voice-ai';
import { resolveVoiceDate, voiceDateContext, voiceDateSchema } from '@/lib/voice-date';

const ctx = { current_date: '2026-10-22', current_day_name: 'giovedì', agenda_selected_date: '2026-11-10' };
describe('date della dettatura', () => {
  it('usa campi locali coerenti anche a cavallo della mezzanotte UTC', () => {
    const now = new Date(2026, 9, 23, 0, 30);
    expect(voiceDateContext(now, ctx.agenda_selected_date)).toEqual({ current_date: '2026-10-23', current_day_name: 'venerdì', agenda_selected_date: '2026-11-10' });
  });
  it.each(['oggi', 'stasera', 'a pranzo', 'a cena'])('%s usa oggi anziché la data aperta', (text) => {
    expect(resolveVoiceDate(`Tavolo per 4 ${text}`, ctx)).toBe('2026-10-22');
  });
  it('domani aggiunge esattamente un giorno', () => expect(resolveVoiceDate('domani sera', ctx)).toBe('2026-10-23'));
  it('dopodomani aggiunge esattamente due giorni', () => expect(resolveVoiceDate('dopodomani', ctx)).toBe('2026-10-24'));
  it.each([['sabato', '2026-10-24'], ['questo sabato', '2026-10-24'], ['venerdì prossimo', '2026-10-23'], ['giovedì', '2026-10-29']])('%s è strettamente successivo', (text, date) => expect(resolveVoiceDate(text, ctx)).toBe(date));
  it('giorno numerico nel mese corrente', () => expect(resolveVoiceDate('per il 28', ctx)).toBe('2026-10-28'));
  it('giorno numerico passato nel mese successivo', () => expect(resolveVoiceDate('il 20', ctx)).toBe('2026-11-20'));
  it.each(['per questo giorno', 'per la data a schermo'])('%s usa agenda', (text) => expect(resolveVoiceDate(text, ctx)).toBe('2026-11-10'));
  it('nessun riferimento temporale usa agenda anche se il modello inventa una data', () => {
    expect(normalizeVoiceBooking({ date: '2027-01-01', pax: 4, time: '20:30' }, ctx.current_date, ctx, 'Tavolo per 4 a nome Rossi alle 20:30').date).toBe('2026-11-10');
  });
  it('nessuna agenda usa oggi', () => expect(resolveVoiceDate('Tavolo per 4', { ...ctx, agenda_selected_date: null })).toBe('2026-10-22'));
  it('scavalca fine anno correttamente', () => expect(resolveVoiceDate('domani', { ...ctx, current_date: '2026-12-31' })).toBe('2027-01-01'));
  it('non scambia date esplicite per giorni del mese corrente', () => expect(resolveVoiceDate('il 25 dicembre', ctx)).toBeNull());
  it('rifiuta date impossibili del modello', () => {
    expect(voiceDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(normalizeVoiceBooking({ date: '2026-02-30' }, ctx.current_date).date).toBe('2026-10-22');
  });
});