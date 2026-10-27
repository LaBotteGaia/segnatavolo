/** Regole di assegnazione personalizzate (dettate o scritte dal Master, interpretate da Gemini). Logica pura e testata. */
import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const tableName = z.string().trim().min(1).max(40);
export const parsedRuleSchema = z.object({
  rule_type: z.enum(['table_reservation', 'pairing_priority', 'isolation_preference', 'fill_order']),
  conditions: z.object({
    pax_exact: z.array(z.number().int().min(1).max(60)).max(20).default([]),
    pax_range: z.tuple([z.number().int().min(1).max(60), z.number().int().min(1).max(60)]).nullable().default(null),
    time_from: hhmm.nullable().default(null),
    time_to: hhmm.nullable().default(null),
  }),
  actions: z.object({
    preferred_tables: z.array(tableName).max(60).default([]),
    pairing_sequence: z.array(z.array(tableName).min(2).max(8)).max(30).default([]),
    avoid_pairable_first: z.boolean().default(false),
    execution_order: z.number().int().min(1).max(99).default(10),
  }),
  human_summary: z.string().trim().min(1).max(300),
});
export type ParsedRule = z.infer<typeof parsedRuleSchema>;
export const parsedRulesSchema = z.object({ rules: z.array(parsedRuleSchema).min(1).max(10) });

export type CustomRule = { id: string; raw_text: string; parsed_logic: unknown; is_active: boolean; created_at?: string };
export type ActiveRule = { id: string; logic: ParsedRule };

/** Solo regole attive e strutturalmente valide, in ordine di esecuzione (poi di creazione). */
export function activeRules(rows: CustomRule[] | undefined | null): ActiveRule[] {
  return (rows ?? []).flatMap(r => {
    if (!r.is_active) return [];
    const parsed = parsedRuleSchema.safeParse(r.parsed_logic);
    return parsed.success ? [{ id: r.id, logic: parsed.data, at: r.created_at ?? '' }] : [];
  }).sort((a, b) => a.logic.actions.execution_order - b.logic.actions.execution_order || a.at.localeCompare(b.at)).map(({ id, logic }) => ({ id, logic }));
}

export const normName = (n: string) => n.trim().toLowerCase().replace(/^(?:t\.?|tav\.?|tavolo)\s*/, '');

export function ruleMatches(rule: ParsedRule, people: number, time: string) {
  const c = rule.conditions;
  const exact = c.pax_exact.length > 0, range = !!c.pax_range;
  if (exact || range) {
    const okExact = exact && c.pax_exact.includes(people);
    const okRange = range && people >= Math.min(...c.pax_range!) && people <= Math.max(...c.pax_range!);
    if (!okExact && !okRange) return false;
  }
  if (c.time_from && time && time < c.time_from) return false;
  if (c.time_to && time && time > c.time_to) return false;
  return true;
}

type Tbl = { name: string; accoppiabile?: boolean | null };
const CAP = 999;
function component(rule: ParsedRule, combo: Tbl[]): number {
  const names = combo.map(t => normName(t.name));
  const a = rule.actions;
  let score = 0;
  if (a.preferred_tables.length) {
    const pref = a.preferred_tables.map(normName);
    score += names.every(n => pref.includes(n)) ? names.reduce((s, n) => s + pref.indexOf(n), 0) : 400;
  }
  if (a.pairing_sequence.length && combo.length > 1) {
    const key = [...names].sort().join('|');
    const idx = a.pairing_sequence.findIndex(seq => seq.map(normName).sort().join('|') === key);
    score += idx >= 0 ? idx : 300;
  }
  if (a.avoid_pairable_first) {
    const pairable = combo.some(t => t.accoppiabile !== false);
    const numeric = Math.min(...names.map(n => /^\d+$/.test(n) ? Number(n) : 99));
    score += (pairable ? 500 : 0) + Math.min(numeric, 99);
  }
  return Math.min(score, CAP);
}

/**
 * Punteggio (più basso = preferito) di un tavolo o di un'unione per una prenotazione.
 * Le regole che corrispondono prevalgono in ordine di esecuzione; i tavoli riservati da altre regole
 * vengono evitati (in modo non bloccante) dalle prenotazioni che non ne soddisfano le condizioni.
 */
export function customScore(combo: Tbl[], people: number, time: string, rules: ActiveRule[] | undefined): number {
  if (!rules?.length || !combo.length) return 0;
  const matching = rules.filter(r => ruleMatches(r.logic, people, time)).slice(0, 4);
  let total = 0;
  matching.forEach((r, i) => { total += component(r.logic, combo) * 1000 ** (matching.length - i); });
  const names = combo.map(t => normName(t.name));
  const reservedByOthers = rules.some(r => r.logic.rule_type === 'table_reservation' && !ruleMatches(r.logic, people, time) && r.logic.actions.preferred_tables.some(p => names.includes(normName(p))));
  // La riserva prevale sull'ordinamento delle altre regole, ma resta non bloccante.
  return total + (reservedByOthers ? 1000 ** (matching.length + 1) : 0);
}

export const hasMatchingRule = (people: number, time: string, rules: ActiveRule[] | undefined) => !!rules?.some(r => ruleMatches(r.logic, people, time));

/** Etichette sintetiche mostrate sulle card. */
export function ruleTags(rule: ParsedRule): string[] {
  const c = rule.conditions, a = rule.actions, tags: string[] = [];
  const type = { table_reservation: 'Riserva tavoli', pairing_priority: 'Priorità abbinamenti', isolation_preference: 'Preferenza isole', fill_order: 'Ordine riempimento' }[rule.rule_type];
  tags.push(type);
  if (c.pax_exact.length) tags.push(`👥 ${c.pax_exact.join(', ')} pax`);
  if (c.pax_range) tags.push(`👥 ${c.pax_range[0]}–${c.pax_range[1]} pax`);
  if (c.time_from || c.time_to) tags.push(`🕒 ${c.time_from ?? '…'}–${c.time_to ?? '…'}`);
  if (a.preferred_tables.length) tags.push(`Tavoli ${a.preferred_tables.join(', ')}`);
  if (a.pairing_sequence.length) tags.push(`Abbinamenti ${a.pairing_sequence.map(s => s.join('+')).join(' → ')}`);
  if (a.avoid_pairable_first) tags.push('🔒 Prima i non abbinabili');
  tags.push(`Priorità ${a.execution_order}`);
  return tags;
}
