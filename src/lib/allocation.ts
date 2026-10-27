/** Unico motore deterministico: regole → comfort → capienza sacrificata/prolunghe → conflitto. */
import { canJoin, NO_EXTRAS, type RTable, type TableExtras } from './data';
import { interval, isRoomClosedFor, tableState, type RotationCfg } from './rotation';
import { customScore, normName, ruleMatches, type ActiveRule } from './custom-rules';
import { assignmentPreference, protectSmallParty, DEFAULT_ASSIGNMENT_RULES, type AssignmentRules } from './assignment-rules';
export type AssignmentTable = Pick<RTable, 'id' | 'name' | 'seats' | 'x' | 'y' | 'room_id' | 'no_join' | 'allow_extras'> & Partial<Pick<RTable, 'accoppiabile' | 'adatto_seduta_lunga' | 'coperti_comodi' | 'coperti_max' | 'posti_scomodi_solo_in_unione' | 'ordine_riempimento'>>;
type RoomLite = { id: string; environment?: string | null; open_days?: number[] | null; closed_periods?: unknown; closed_shifts?: string[] | null; walls?: unknown };
type Other = { id: string; name: string; table_ids: string[]; time: string; duration_min?: number | null; buffer_min?: number | null; no_show?: boolean; tavolo_bloccato?: boolean | null };
export type Suggestion = { ids: string[]; extras: TableExtras; kind: 'single' | 'extension' | 'join'; waste: number; ha_posti_scomodi: boolean; stage: 1 | 2 | 3; ruleId?: string };
export type AssignmentParams = {
  people: number; date: string; shift: string; time: string; tables: AssignmentTable[]; rooms: RoomLite[]; others: Other[]; cfg: RotationCfg;
  outside?: boolean; wallsFor: (roomId: string) => string[];
  me?: { id: string; duration_min?: number | null; buffer_min?: number | null };
  rules?: AssignmentRules; notes?: string; customRules?: ActiveRule[];
  /** Gli accomodamenti al volo restano singoli; unioni ed extra richiedono il flusso prenotazione. */
  singleOnly?: boolean; allowSingleMax?: boolean;
};
const comfort = (t: AssignmentTable) => t.coperti_comodi ?? t.seats;
const maxSeats = (t: AssignmentTable) => Math.max(comfort(t), t.coperti_max ?? t.seats);
const adjacent = (a: AssignmentTable, b: AssignmentTable) => a.room_id === b.room_id && Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)) <= 1;
export function calculateBestTableAssignment(p: AssignmentParams): Suggestion | null {
  const me = { id: p.me?.id ?? 'new', time: p.time, duration_min: p.me?.duration_min ?? null, buffer_min: p.me?.buffer_min ?? null };
  if (!Number.isInteger(p.people) || p.people < 1 || !Number.isFinite(interval(me,p.cfg).start)) return null;
  const rules = p.rules ?? DEFAULT_ASSIGNMENT_RULES;
  const openRooms = p.rooms.filter(r => !isRoomClosedFor(r as never,p.date,p.shift));
  const zone = p.outside === undefined ? openRooms : openRooms.filter(r => (r.environment === 'esterno') === p.outside);
  const roomIds = new Set((zone.length ? zone : openRooms).map(r => r.id));
  const free = p.tables.filter(t => roomIds.has(t.room_id) && tableState(t.id,me,p.others,p.cfg).kind !== 'busy');
  const roomOrder = new Map(p.rooms.map((r,i) => [r.id,i]));
  const pref = (t: AssignmentTable) => assignmentPreference(t,{...me,notes:p.notes ?? ''},rules,p.rooms);
  const stable = (a: AssignmentTable,b: AssignmentTable) => (roomOrder.get(a.room_id) ?? 999)-(roomOrder.get(b.room_id) ?? 999) || (a.ordine_riempimento ?? 10)-(b.ordine_riempimento ?? 10) || a.name.localeCompare(b.name,'it',{numeric:true}) || a.id.localeCompare(b.id);
  const connected = (combo: AssignmentTable[]) => {
    const first = combo[0]; if (!first) return false;
    const seen = new Set([first]);
    for (const a of seen) for (const b of combo) if (!seen.has(b) && adjacent(a,b)) seen.add(b);
    return seen.size === combo.length;
  };
  const valid = (combo: AssignmentTable[]) => combo.length > 0 && new Set(combo.map(t=>t.id)).size === combo.length && connected(combo) && combo.every(a=>combo.every(b=>a===b || (a.room_id===b.room_id && canJoin(a,b,p.wallsFor))));
  const fit = (combo: AssignmentTable[], sacrifice: boolean, extend: boolean): Suggestion | null => {
    if (!valid(combo) || (p.singleOnly && combo.length !== 1)) return null;
    const comodi = combo.reduce((s,t)=>s+comfort(t),0);
    const base = sacrifice ? combo.reduce((s,t)=>s+(combo.length > 1 || p.allowSingleMax || t.posti_scomodi_solo_in_unione === false ? maxSeats(t) : comfort(t)),0) : comodi;
    const deficit = Math.max(0,p.people-base);
    if (deficit && (!extend || p.singleOnly || p.people <= 8 || deficit > combo.filter(t=>t.allow_extras).length)) return null;
    return { ids:combo.map(t=>t.id), extras:deficit ? {...NO_EXTRAS,extra_sponde:deficit} : NO_EXTRAS, kind:combo.length>1?'join':deficit?'extension':'single', waste:Math.max(0,base-p.people), ha_posti_scomodi:p.people>comodi, stage:sacrifice||deficit?3:2 };
  };
  const allCombos = (list: AssignmentTable[]) => {
    const out: AssignmentTable[][] = [], visited = new Set<string>();
    const explore = (combo: AssignmentTable[]) => {
      const key=combo.map(t=>t.id).sort().join('|'); if(visited.has(key)) return;
      visited.add(key); out.push(combo);
      if(p.singleOnly || combo.reduce((s,t)=>s+comfort(t),0)>=p.people) return;
      for(const next of list) if(!combo.includes(next) && combo.some(t=>adjacent(t,next)) && combo.every(t=>canJoin(t,next,p.wallsFor))) explore([...combo,next]);
    };
    for(const t of [...list].sort(stable)) explore([t]);
    return out;
  };
  const matching = [...(p.customRules ?? [])].filter(r=>ruleMatches(r.logic,p.people,p.time)).sort((a,b)=>b.logic.priority_rank-a.logic.priority_rank);
  // Prima regola che offre una soluzione sicura: nessun punteggio può annullarne la priorità.
  for(const r of matching) {
    const a=r.logic.actions;
    let eligible=free.filter(t=>!a.force_zone_id || t.room_id===a.force_zone_id);
    if(a.avoid_pairable) eligible=eligible.filter(t=>t.accoppiabile===false);
    if(!eligible.length) continue;
    const ordered=a.preferred_table_numbers.length ? a.preferred_table_numbers.flatMap(n=>eligible.filter(t=>normName(t.name)===normName(n)).sort(stable)) : [...eligible].sort((x,y)=>x.name.localeCompare(y.name,'it',{numeric:true})||stable(x,y));
    const hasAction = a.avoid_pairable || a.force_zone_id || a.preferred_table_numbers.length || a.pairing_sequence.length;
    if(!hasAction) continue;
    // Singolo comodo indicato; se serve un'unione, sequenze esplicite prima delle altre.
    const single=ordered.map(t=>fit([t],false,false)).find(s=>s!==null);
    if(single && (a.preferred_table_numbers.length || !a.pairing_sequence.length)) return {...single,stage:1,ruleId:r.id};
    for(const sequence of a.pairing_sequence) {
      for(const room of openRooms) {
        const combo=sequence.flatMap(n=>{const t=eligible.find(t=>t.room_id===room.id && normName(t.name)===normName(n));return t?[t]:[];});
        if(combo.length!==sequence.length) continue;
        const s=fit(combo,false,false) ?? fit(combo,true,false) ?? fit(combo,true,true);
        if(s) return {...s,stage:1,ruleId:r.id};
      }
    }
    const combos=allCombos(ordered);
    for(const [sacrifice,extend] of [[false,false],[true,false],[true,true]]) {
      for(const combo of combos) {const s=fit(combo,sacrifice,extend);if(s) return {...s,stage:1,ruleId:r.id};}
    }
  }
  const reservationPenalty=(t: AssignmentTable)=>customScore([t],p.people,p.time,p.customRules);
  const singles=protectSmallParty(free.filter(t=>comfort(t)>=p.people),p.people,rules).sort((a,b)=>reservationPenalty(a)-reservationPenalty(b)||pref(a)-pref(b)||comfort(a)-comfort(b)||stable(a,b));
  const single=singles[0]; if(single) return fit([single],false,false);
  const combos=allCombos(free);
  const ranked=(sacrifice:boolean,extend:boolean)=>combos.flatMap(combo=>{const s=fit(combo,sacrifice,extend);return s?[{s,combo}]:[];}).sort((a,b)=>a.s.extras.extra_sponde-b.s.extras.extra_sponde || a.combo.reduce((s,t)=>s+pref(t),0)-b.combo.reduce((s,t)=>s+pref(t),0) || a.s.waste-b.s.waste || a.combo.length-b.combo.length || stable(a.combo[0] ?? free[0],b.combo[0] ?? free[0]));
  return ranked(false,false)[0]?.s ?? ranked(true,false)[0]?.s ?? ranked(true,true)[0]?.s ?? null;
}
/** Compatibilità per tutti i chiamanti esistenti. */
export const suggestTables = calculateBestTableAssignment;
