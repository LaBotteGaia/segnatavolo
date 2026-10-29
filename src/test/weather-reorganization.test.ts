import { describe,it,expect } from 'vitest';
import { weatherReorganization } from '../lib/weather-reorganization';
import { isRoomClosedFor } from '../lib/rotation';
const base = {date:'2026-10-29',shift:'sera',cfg:{duration:90,buffer:15},wallsFor:()=>[],rooms:[{id:'inside',environment:'interno',is_outdoor:false},{id:'out',environment:'esterno',is_outdoor:true}],tables:[{id:'i',name:'1',room_id:'inside',seats:4,x:0,y:0,no_join:[],allow_extras:false},{id:'o',name:'2',room_id:'out',seats:10,x:0,y:0,no_join:[],allow_extras:false}]};
const r = (id:string,people:number) => ({id,name:id,people,time:'20:00',outside:true,table_ids:['o']});
describe('Riallocazione maltempo',()=>{
  it('sposta solo all’interno ignorando preferenza esterna',()=>expect(weatherReorganization({...base,reservations:[r('a',2)]}).plan[0]?.ids).toEqual(['i']));
  it('senza capienza libera tavoli esterni senza perdere prenotazione',()=>{const out=weatherReorganization({...base,reservations:[r('a',8)]});expect(out.plan).toEqual([{id:'a',ids:[],extra_sponde:0,ha_posti_scomodi:false}]);expect(out.result.unplaced[0]?.id).toBe('a');});
  it('non sovrappone le comitive',()=>{const out=weatherReorganization({...base,reservations:[r('a',4),r('b',4)]});expect(out.plan.filter(p=>p.ids.includes('i'))).toHaveLength(1);});
  it('prenotazioni interne bloccate mantengono il posto',()=>{const out=weatherReorganization({...base,reservations:[{...r('locked',4),table_ids:['i'],outside:false,tavolo_bloccato:true},r('a',4)]});expect(out.plan).toHaveLength(1);expect(out.plan[0]?.ids).toEqual([]);});
  it('chiusura solo per data e turno esatti',()=>{const room={closed_shifts:['2026-10-29|sera']};expect(isRoomClosedFor(room,'2026-10-29','sera')).toBe(true);expect(isRoomClosedFor(room,'2026-10-29','pranzo')).toBe(false);expect(isRoomClosedFor(room,'2026-10-30','sera')).toBe(false);});
});