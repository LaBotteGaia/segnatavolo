import { describe,expect,it } from 'vitest';
import { DEFAULT_ASSIGNMENT_RULES, assignmentRulesSchema, isLongStay, normalizeAssignmentRules, protectSmallParty, configurationError } from '@/lib/assignment-rules';
import { canJoin } from '@/lib/data';
describe('regole sala',()=>{
  it('le regole nuove sono disattivate per default',()=>expect(normalizeAssignmentRules(null)).toEqual({longStay:{enabled:false,from:'21:00'},protectModular:false}));
  it('seduta lunga dalle 21:00, non alle 20:59',()=>{const r={...DEFAULT_ASSIGNMENT_RULES,longStay:{enabled:true,from:'21:00'}};expect(isLongStay({time:'21:00'},r)).toBe(true);expect(isLongStay({time:'20:59'},r)).toBe(false);});
  it('nota seduta lunga prima della soglia',()=>expect(isLongStay({time:'19:00',notes:'Tutta la serata'}, {...DEFAULT_ASSIGNMENT_RULES,longStay:{enabled:true,from:'21:00'}})).toBe(true));
  it('isola mai unibile in nessuna direzione',()=>{const a={id:'a',room_id:'r',x:0,y:0,no_join:[],accoppiabile:false};const b={...a,id:'b',x:1,accoppiabile:true};expect(canJoin(a,b,()=>[])).toBe(false);expect(canJoin(b,a,()=>[])).toBe(false);});
  it('protezione piccoli gruppi limitata a 2 e 3 persone',()=>{const ts=[{room_id:'r',accoppiabile:true},{room_id:'r',accoppiabile:false}];const rules={...DEFAULT_ASSIGNMENT_RULES,protectModular:true};expect(protectSmallParty(ts,2,rules)).toEqual([ts[1]]);expect(protectSmallParty(ts,3,rules)).toEqual([ts[1]]);expect(protectSmallParty(ts,4,rules)).toEqual(ts);});
  it('rigetta orari fuori schema della bozza IA',()=>expect(assignmentRulesSchema.safeParse({longStay:{enabled:true,from:'25:00'},protectModular:true}).success).toBe(false));
  it('errore formale Master',()=>expect(configurationError({code:'42501'})).toBe("Modifica non consentita: permessi riservati all'utente Master del ristorante"));
});