import { describe,it,expect } from 'vitest';
import { bookingSchema,dayAvailable,onlineConfigSchema,slugFromName,slugSchema,partyLimit,confirmedBooking } from '@/lib/online-booking';
const booking={slug:'labottegaia',request_id:'123e4567-e89b-42d3-a456-426614174000',people:2,date:'2026-10-23',shift:'pranzo',time:'12:00',name:'Mario Rossi',phone:'340 123-4567',email:'mario@example.com',notes:'',outside:false,privacy:true,marketing:false};
describe('prenotazioni online',()=>{
  it('limita la comitiva a 6 coperti quando ci sono 10 posti residui',()=>expect(partyLimit(10,6)).toBe(6));
  it('limita la scelta ai 3 posti residui anche con tetto 6',()=>expect(partyLimit(3,6)).toBe(3));
  it('blocca la scelta se non rimangono posti',()=>expect(partyLimit(0,6)).toBe(0));
  it('non considera una richiesta pending una visita confermata',()=>expect(confirmedBooking({status:'pending'})).toBe(false));
  it('non considera una richiesta rejected una visita confermata',()=>expect(confirmedBooking({status:'rejected'})).toBe(false));
  it('mantiene confermate le prenotazioni esistenti',()=>expect(confirmedBooking({status:'confirmed'})).toBe(true));
 it('richiede il consenso obbligatorio',()=>expect(bookingSchema.safeParse({...booking,privacy:false}).success).toBe(false));
 it('marketing facoltativo non necessario',()=>expect(bookingSchema.parse(booking).marketing).toBe(false));
 it('identità cliente per telefono normalizzato',()=>expect(bookingSchema.parse(booking).phone).toBe('3401234567'));
 it('esclude giorni senza posti e accetta il limite esatto',()=>{expect(dayAvailable({date:booking.date,pranzo:null,sera:1},2)).toBe(false);expect(dayAvailable({date:booking.date,pranzo:2,sera:null},2)).toBe(true);});
 it('supporta cutoff 24 e 48 ore e giorno precedente',()=>{for(const cutoff of ['24h','48h','previous_day'])expect(onlineConfigSchema.parse({cutoff}).cutoff).toBe(cutoff);});
 it('slug compatibile con il link pubblico',()=>{expect(slugFromName('Osteria La BotteGaia')).toBe('osteria-la-bottegaia');expect(slugSchema.safeParse('Locale/altro').success).toBe(false);});
});
