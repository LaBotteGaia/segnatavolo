/** Regole validate; le bozze nuove sono rigorose, quelle storiche vengono convertite solo in lettura. */
import { z } from 'zod';
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const tableName = z.string().trim().min(1).max(40);
export const parsedRuleSchema = z.object({
  rule_type: z.enum(['table_priority', 'pairing_priority', 'isolation_preference']),
  conditions: z.object({ min_pax: z.number().int().min(1).max(60), max_pax: z.number().int().min(1).max(60), time_from: hhmm.nullable(), time_to: hhmm.nullable() }).strict().refine(c => c.min_pax <= c.max_pax, 'Intervallo coperti non valido'),
  actions: z.object({ preferred_table_numbers: z.array(tableName).max(60), pairing_sequence: z.array(z.array(tableName).min(2).max(8).refine(s => new Set(s.map(normName)).size === s.length, 'Tavoli duplicati nell’unione')).max(30), avoid_pairable: z.boolean(), force_zone_id: z.string().uuid().nullable() }).strict(),
  priority_rank: z.number().int().min(1).max(10),
  human_summary: z.string().trim().min(1).max(300),
}).strict();
export type ParsedRule = z.infer<typeof parsedRuleSchema>;
export const parsedRulesSchema = z.object({ rules: z.array(parsedRuleSchema).min(1).max(10) }).strict();
export type CustomRule = { id: string; restaurant_id?: string | null; raw_text: string; parsed_logic: unknown; is_active: boolean; created_at?: string };
export type ActiveRule = { id: string; logic: ParsedRule };
export function normName(n: string) { return n.trim().toLowerCase().replace(/^(?:t\.?|tav\.?|tavolo)\s*/, ''); }
const legacy = z.object({
  rule_type: z.enum(['table_reservation', 'pairing_priority', 'isolation_preference', 'fill_order']),
  conditions: z.object({ pax_exact: z.array(z.number().int().min(1).max(60)).default([]), pax_range: z.tuple([z.number().int().min(1).max(60), z.number().int().min(1).max(60)]).nullable().default(null), time_from: hhmm.nullable().default(null), time_to: hhmm.nullable().default(null) }),
  actions: z.object({ preferred_tables: z.array(tableName).default([]), pairing_sequence: z.array(z.array(tableName).min(2).max(8)).default([]), avoid_pairable_first: z.boolean().default(false), execution_order: z.number().int().min(1).max(99).default(10) }),
  human_summary: z.string().min(1).max(300),
});
export function storedRules(value: unknown): ParsedRule[] {
  const bundle = parsedRulesSchema.safeParse(value);
  if (bundle.success) return bundle.data.rules;
  const current = parsedRuleSchema.safeParse(value);
  if (current.success) return [current.data];
  const old = legacy.safeParse(value);
  if (!old.success) return [];
  const r = old.data;
  const ranges = r.conditions.pax_exact.length ? r.conditions.pax_exact.map(n => [n, n]) : [r.conditions.pax_range ?? [1, 60]];
  return ranges.flatMap(range => {
    const parsed = parsedRuleSchema.safeParse({
      rule_type: ['table_reservation', 'fill_order'].includes(r.rule_type) ? 'table_priority' : r.rule_type,
      conditions: { min_pax: Math.min(...range), max_pax: Math.max(...range), time_from: r.conditions.time_from, time_to: r.conditions.time_to },
      actions: { preferred_table_numbers: r.actions.preferred_tables, pairing_sequence: r.actions.pairing_sequence, avoid_pairable: r.actions.avoid_pairable_first, force_zone_id: null },
      priority_rank: Math.max(1, 11 - Math.min(10, r.actions.execution_order)), human_summary: r.human_summary,
    });
    return parsed.success ? [parsed.data] : [];
  });
}
export function activeRules(rows: CustomRule[] | undefined | null, restaurantId?: string): ActiveRule[] {
  return (rows ?? []).filter(r => r.is_active && (!restaurantId || r.restaurant_id === restaurantId)).flatMap(r => storedRules(r.parsed_logic).map((logic, i) => ({ id: `${r.id}:${i}`, logic, at: r.created_at ?? '' })))
    .sort((a,b) => b.logic.priority_rank - a.logic.priority_rank || a.at.localeCompare(b.at) || a.id.localeCompare(b.id)).map(({id,logic}) => ({id,logic}));
}
export function ruleMatches(rule: ParsedRule, people: number, time: string) {
  const c = rule.conditions;
  if (people < c.min_pax || people > c.max_pax) return false;
  if ((c.time_from || c.time_to) && !hhmm.safeParse(time).success) return false;
  if (c.time_from && c.time_to && c.time_from > c.time_to) return time >= c.time_from || time <= c.time_to;
  return (!c.time_from || time >= c.time_from) && (!c.time_to || time <= c.time_to);
}
/** Conserva la salvaguardia delle riserve non corrispondenti durante le euristiche. */
export function customScore(combo: {name: string; accoppiabile?: boolean | null}[], people: number, time: string, rules?: ActiveRule[]): number {
  const names = combo.map(t => normName(t.name));
  const matching = rules?.find(r => ruleMatches(r.logic, people, time));
  const a = matching?.logic.actions;
  let score = 0;
  if (a?.preferred_table_numbers.length) score += names.every(n => a.preferred_table_numbers.map(normName).includes(n)) ? 0 : 400;
  if (a?.pairing_sequence.length && combo.length > 1) { const i = a.pairing_sequence.findIndex(s => s.map(normName).sort().join('|') === [...names].sort().join('|')); score += i < 0 ? 300 : i; }
  if (a?.avoid_pairable) score += combo.some(t => t.accoppiabile !== false) ? 500 : Math.min(...names.map(n => /^\d+$/.test(n) ? Number(n) : 99));
  if (rules?.some(r => r.logic.rule_type === 'table_priority' && !ruleMatches(r.logic, people, time) && r.logic.actions.preferred_table_numbers.some(p => names.includes(normName(p))))) score += 10000;
  return score;
}
export const hasMatchingRule = (people: number, time: string, rules?: ActiveRule[]) => !!rules?.some(r => ruleMatches(r.logic, people, time));
export function ruleTags(r: ParsedRule): string[] {
  const a = r.actions, c = r.conditions;
  return [`Pax: ${c.min_pax}–${c.max_pax}`, ...(a.preferred_table_numbers.length ? [`Tavoli: ${a.preferred_table_numbers.join(', ')}`] : []), ...(a.pairing_sequence.length ? [`Abbinamenti: ${a.pairing_sequence.map(s => s.join('+')).join(' → ')}`] : []), ...(a.avoid_pairable ? ['No Componibili'] : []), ...(a.force_zone_id ? ['Zona vincolata'] : []), ...(c.time_from || c.time_to ? [`Orario: ${c.time_from ?? '…'}–${c.time_to ?? '…'}`] : []), `Priorità: ${r.priority_rank}`];
}
