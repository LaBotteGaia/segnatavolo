import { describe, it, expect } from 'vitest';
import { suggestTables } from '@/lib/allocation';
import { isLastResort, type ActiveRule } from '@/lib/custom-rules';
const t = (name: string, x: number, y: number, seats: number, max = seats) => ({ id: name, name, seats, coperti_comodi: seats, coperti_max: max, x, y, room_id: 'r', no_join: [], allow_extras: false, accoppiabile: true, posti_scomodi_solo_in_unione: false });
const base = { date: '2026-11-15', shift: 'sera' as const, time: '19:30', rooms: [{ id: 'r', name: 'Sala', sort_order: 1, open_days: [0,1,2,3,4,5,6], closed_periods: [], closed_shifts: [], walls: [] }] as never, others: [], cfg: { duration: 90, buffer: 15 } };
const lastResort: ActiveRule = { id: 'x', logic: { rule_type: 'table_priority', conditions: { min_pax: 3, max_pax: 5, time_from: null, time_to: null }, actions: { preferred_table_numbers: ['10'], pairing_sequence: [], avoid_pairable: false, force_zone_id: null }, priority_rank: 10, human_summary: 'Assegna il tavolo 10 soltanto come ultima scelta' } };
describe('comfort prima dei posti stretti', () => {
  it('5 persone: unione comoda 2+3 preferita al tavolo da 4 estendibile a 6', () => {
    const s = suggestTables({ ...base, people: 5, tables: [t('10', 5, 5, 4, 6), t('5', 0, 1, 2), t('6', 0, 0, 3)] });
    expect([...(s?.ids ?? [])].sort()).toEqual(['5', '6']);
    expect(s?.ha_posti_scomodi).toBe(false);
  });
  it('regola "ultima scelta" non promuove il tavolo 10', () => {
    expect(isLastResort(lastResort.logic)).toBe(true);
    const s = suggestTables({ ...base, people: 5, customRules: [lastResort], tables: [t('10', 5, 5, 4, 6), t('5', 0, 1, 2), t('6', 0, 0, 3)] });
    expect(s?.ids).not.toContain('10');
  });
  it('senza alternative comode il tavolo stretto resta proposto', () => {
    const s = suggestTables({ ...base, people: 5, tables: [t('10', 5, 5, 4, 6)] });
    expect(s?.ids).toEqual(['10']);
  });
});
