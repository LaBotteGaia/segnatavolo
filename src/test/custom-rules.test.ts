import { describe, expect, it } from 'vitest';
import { activeRules, customScore, ruleMatches, type CustomRule, type ParsedRule } from '@/lib/custom-rules';
import { suggestTables } from '@/lib/allocation';

const rule = (p: Partial<ParsedRule> & Pick<ParsedRule, 'rule_type'>): ParsedRule => ({
  conditions: { min_pax: 1, max_pax: 60, time_from: null, time_to: null },
  actions: { preferred_table_numbers: [], pairing_sequence: [], avoid_pairable: false, force_zone_id: null },
  priority_rank: 5, human_summary: 'test', ...p,
});
const reserve4 = rule({ rule_type: 'table_priority', priority_rank: 10, conditions: { min_pax: 4, max_pax: 4, time_from: null, time_to: null }, actions: { preferred_table_numbers: ['1', '2', '3'], pairing_sequence: [['1', '2'], ['2', '3']], avoid_pairable: false, force_zone_id: null } });
const islands2 = rule({ rule_type: 'isolation_preference', priority_rank: 9, conditions: { min_pax: 2, max_pax: 3, time_from: null, time_to: null }, actions: { preferred_table_numbers: [], pairing_sequence: [], avoid_pairable: true, force_zone_id: null } });
const rows: CustomRule[] = [
  { id: 'a', raw_text: 'r', parsed_logic: reserve4, is_active: true },
  { id: 'b', raw_text: 'r', parsed_logic: islands2, is_active: true },
  { id: 'c', raw_text: 'r', parsed_logic: reserve4, is_active: false },
];
const rules = activeRules(rows);

const t = (id: string, x: number, seats: number, accoppiabile = true) => ({ id, name: id, seats, coperti_comodi: seats, coperti_max: seats, x, y: 0, room_id: 'r', no_join: [], allow_extras: true, accoppiabile });
const base = { date: '2026-10-28', shift: 'sera', time: '20:00', rooms: [{ id: 'r' }], others: [], cfg: { duration: 90, buffer: 15 }, wallsFor: () => [] as string[] };

describe('regole personalizzate', () => {
  it('ignora le regole disattivate', () => { expect(rules.map(r => r.id)).toEqual(['a:0', 'b:0']); });
  it('la riserva vale solo per 4 persone', () => { expect(ruleMatches(reserve4, 4, '20:00')).toBe(true); expect(ruleMatches(reserve4, 5, '20:00')).toBe(false); });
  it('1+2 ha priorità su 2+3', () => {
    expect(customScore([t('1', 0, 2), t('2', 1, 2)], 4, '20:00', rules)).toBeLessThan(customScore([t('2', 1, 2), t('3', 2, 2)], 4, '20:00', rules));
  });
  it('per 4 persone abbina 1+2 anche se esiste un tavolo singolo da 4', () => {
    const s = suggestTables({ ...base, people: 4, tables: [t('1', 0, 2), t('2', 1, 2), t('3', 2, 2), t('9', 6, 4)], customRules: rules });
    expect(s?.ids.sort()).toEqual(['1', '2']);
  });
  it('le coppie vanno prima sui tavoli non abbinabili in ordine crescente', () => {
    const s = suggestTables({ ...base, people: 2, tables: [t('1', 0, 2), t('5', 4, 2, false), t('4', 8, 2, false)], customRules: rules });
    expect(s?.ids).toEqual(['4']);
  });
  it('le coppie evitano i tavoli riservati ai 4', () => {
    const s = suggestTables({ ...base, people: 2, tables: [t('1', 0, 2), t('7', 4, 2)], customRules: rules });
    expect(s?.ids).toEqual(['7']);
  });
});
