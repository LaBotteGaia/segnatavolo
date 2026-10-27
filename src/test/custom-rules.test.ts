import { describe, expect, it } from 'vitest';
import { activeRules, customScore, ruleMatches, storedRules, parsedRuleSchema, type CustomRule, type ParsedRule } from '@/lib/custom-rules';
import { reorganizeService } from '@/lib/reorganize';
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

describe('priorità deterministiche e salvaguardie', () => {
  const pref = (name: string, priority_rank: number): ParsedRule => rule({rule_type:'table_priority', priority_rank, actions:{preferred_table_numbers:[name],pairing_sequence:[],avoid_pairable:false,force_zone_id:null}});
  it('10 prevale su 1 anche con ordine input inverso',()=>expect(suggestTables({...base,people:2,tables:[t('1',0,2),t('2',3,2)],customRules:[{id:'low',logic:pref('1',1)},{id:'high',logic:pref('2',10)}]})?.ids).toEqual(['2']));
  it('passa alla regola successiva se la prima non trova spazio sicuro',()=>expect(suggestTables({...base,people:2,tables:[t('1',0,2),t('2',3,2)],others:[{id:'busy',name:'X',time:'20:00',table_ids:['1']}],customRules:[{id:'high',logic:pref('1',10)},{id:'low',logic:pref('2',1)}]})?.ids).toEqual(['2']));
  it('ordine unioni 1+2 poi 3+4 quando 1 è occupato',()=>{const logic=rule({rule_type:'pairing_priority',actions:{preferred_table_numbers:[],pairing_sequence:[['1','2'],['3','4']],avoid_pairable:false,force_zone_id:null}});expect(suggestTables({...base,people:4,tables:[t('1',0,2),t('2',1,2),t('3',5,2),t('4',6,2)],others:[{id:'busy',name:'X',time:'20:00',table_ids:['1']}],customRules:[{id:'r',logic}]})?.ids).toEqual(['3','4']);});
  it('la fascia oraria è inclusiva e fuori fascia non applica la regola',()=>{const r={...pref('2',10),conditions:{min_pax:2,max_pax:3,time_from:'20:00',time_to:'21:00'}};expect(ruleMatches(r,2,'20:00')).toBe(true);expect(ruleMatches(r,3,'21:00')).toBe(true);expect(ruleMatches(r,2,'19:59')).toBe(false);expect(ruleMatches(r,4,'20:00')).toBe(false);});
  it('nessuna regola scavalca il riassetto di 15 minuti',()=>expect(suggestTables({...base,time:'21:44',people:2,tables:[t('1',0,2)],others:[{id:'x',name:'X',time:'20:00',table_ids:['1']}],customRules:[{id:'r',logic:pref('1',10)}]})).toBeNull());
  it('il comfort standard precede i posti scomodi',()=>{const s=suggestTables({...base,people:3,tables:[{...t('1',0,2),coperti_max:3,posti_scomodi_solo_in_unione:false},t('2',3,4)]});expect(s?.ids).toEqual(['2']);expect(s?.ha_posti_scomodi).toBe(false);});
  it('l’ultimo stadio di capienza segnala i posti scomodi',()=>{const s=suggestTables({...base,people:3,tables:[{...t('1',0,2),coperti_max:3,posti_scomodi_solo_in_unione:false}]});expect(s?.stage).toBe(3);expect(s?.ha_posti_scomodi).toBe(true);});
  it('applica una zona UUID senza scegliere tavoli della zona opposta',()=>{const zone='00000000-0000-4000-8000-000000000001';const logic=rule({rule_type:'table_priority',actions:{preferred_table_numbers:[],pairing_sequence:[],avoid_pairable:false,force_zone_id:zone}});expect(suggestTables({...base,people:2,rooms:[{id:'r'},{id:zone}],tables:[t('1',0,2),{...t('2',0,2),room_id:zone}],customRules:[{id:'r',logic}]})?.ids).toEqual(['2']);});
  it('esclude regole di un altro ristorante anche con cache mista',()=>expect(activeRules([{...rows[0],id:'own',raw_text:'x',parsed_logic:reserve4,is_active:true,restaurant_id:'own'},{id:'other',raw_text:'x',parsed_logic:reserve4,is_active:true,restaurant_id:'other'}],'own').map(r=>r.id)).toEqual(['own:0']));
  it('conserva le condizioni disgiunte delle regole storiche',()=>{const converted=storedRules({rule_type:'table_reservation',conditions:{pax_exact:[2,4]},actions:{preferred_tables:['1']},human_summary:'storica'});expect(converted).toHaveLength(2);expect(converted.some(r=>ruleMatches(r,3,'20:00'))).toBe(false);});
  it('rifiuta lo schema incompleto o con range inverso',()=>{expect(parsedRuleSchema.safeParse({rule_type:'table_priority'}).success).toBe(false);expect(parsedRuleSchema.safeParse({...pref('1',10),conditions:{min_pax:4,max_pax:2,time_from:null,time_to:null}}).success).toBe(false);});
  it('nuova prenotazione e riorganizzazione scelgono la stessa unione',()=>{const tables=[t('1',0,2),t('2',1,2),t('9',5,4)];const s=suggestTables({...base,people:4,tables,customRules:rules});const out=reorganizeService({...base,tables,customRules:rules,reservations:[{id:'x',name:'X',people:4,time:'20:00',table_ids:[],outside:false}]});expect(out.assignments.get('x')?.ids).toEqual(s?.ids);});
});
