import { describe,it,expect } from 'vitest';
import { exceptionState,scheduleExceptionSchema,type ScheduleException } from '@/lib/schedule-exceptions';
import { notifyRestaurantForBooking } from '@/lib/online-notifications';
import { bookingPolicySchema } from '@/lib/booking-policy';
import { closedShifts,DEFAULT_SETTINGS } from '@/lib/data';
import { isRoomClosedFor } from '@/lib/rotation';
const e:ScheduleException={id:'123e4567-e89b-42d3-a456-426614174000',exception_type:'chiusura_straordinaria',start_date:'2026-11-02',end_date:'2026-11-08',applies_to:'solo_pranzo',reason:'Ferie'};
describe('eccezioni, ereditarietà e notifiche online',()=>{
 it('conferme al locale spente di default',()=>expect(notifyRestaurantForBooking('confirmed')).toBe(false));
 it('conferme al locale solo con opzione esplicita',()=>expect(notifyRestaurantForBooking('confirmed',true)).toBe(true));
 it('nuove richieste mantengono la notifica separata',()=>expect(notifyRestaurantForBooking('pending',false)).toBe(true));
 it('turni ereditati per impostazione iniziale',()=>expect(bookingPolicySchema.parse({}).online_turns_override).toBe(false));
 it('intervallo inclusivo solo pranzo',()=>{expect(exceptionState([e],'2026-11-02','pranzo')).toBe('closed');expect(exceptionState([e],'2026-11-08','pranzo')).toBe('closed');expect(exceptionState([e],'2026-11-09','pranzo')).toBeNull();expect(exceptionState([e],'2026-11-03','sera')).toBeNull();});
 it('chiusura prevale su apertura sovrapposta',()=>expect(exceptionState([e,{...e,exception_type:'apertura_straordinaria'}],'2026-11-03','pranzo')).toBe('closed'));
 it('apertura sblocca riposo settimanale del lunedì',()=>{const st={...DEFAULT_SETTINGS,weekly:{'1':['pranzo','sera'] as ('pranzo'|'sera')[]},schedule_exceptions:[{...e,exception_type:'apertura_straordinaria' as const}]};expect(closedShifts('2026-11-02',st)).toEqual(['sera']);});
 it('apertura sblocca sala nel giorno di riposo ma non chiusura meteo',()=>{const room={open_days:[2],schedule_exceptions:[{...e,exception_type:'apertura_straordinaria'}]};expect(isRoomClosedFor(room,'2026-11-02','pranzo')).toBe(false);expect(isRoomClosedFor({...room,closed_shifts:['2026-11-02|pranzo']},'2026-11-02','pranzo')).toBe(true);});
 it('intervallo invertito non valido',()=>expect(scheduleExceptionSchema.safeParse({...e,end_date:'2026-11-01'}).success).toBe(false));
 it('data singola ammessa',()=>expect(scheduleExceptionSchema.safeParse({...e,end_date:e.start_date}).success).toBe(true));
});