import { describe, it, expect } from 'vitest';
import { DEFAULT_BOOKING_POLICY as policy, bookingPolicySchema, bookingDateAllowed, localClock, reconfirmationBadge, managementInputSchema } from '@/lib/booking-policy';

describe('regole online e riconferma', () => {
  it('parte da domani con anticipo massimo 30 giorni', () => { expect(bookingDateAllowed('2026-11-01','2026-11-01',policy)).toBe(false); expect(bookingDateAllowed('2026-11-02','2026-11-01',policy)).toBe(true); expect(bookingDateAllowed('2026-12-01','2026-11-01',policy)).toBe(true); expect(bookingDateAllowed('2026-12-02','2026-11-01',policy)).toBe(false); });
  it('consente oggi soltanto con opzione esplicita', () => expect(bookingDateAllowed('2026-11-01','2026-11-01',{...policy,allow_same_day_online:true})).toBe(true));
  it('durata primo turno 90 minuti e tolleranza 15 minuti', () => { expect(policy.first_shift_duration_minutes).toBe(90); expect(policy.no_show_tolerance_minutes).toBe(15); });
  it('09:00 Roma corrisponde a 08 UTC in inverno e 07 UTC in estate', () => { expect(localClock(new Date('2026-11-01T08:00:00Z')).minutes).toBe(540); expect(localClock(new Date('2026-07-01T07:00:00Z')).minutes).toBe(540); });
  it('respinge fusi inesistenti', () => expect(bookingPolicySchema.safeParse({timezone:'Fuso/Falso'}).success).toBe(false));
  const row={channel:'online',status:'confirmed',date:'2026-11-01',time:'12:00',arrived:false,confirmation_status:'in_attesa_riconferma'};
  it('evidenzia la mancata riconferma solo oggi e solo online', () => { expect(reconfirmationBadge(row,new Date('2026-11-01T09:00:00Z'),policy)?.label).toBe('Da riconfermare'); expect(reconfirmationBadge({...row,channel:'internal'},new Date('2026-11-01T09:00:00Z'),policy)).toBeNull(); expect(reconfirmationBadge(row,new Date('2026-11-02T09:00:00Z'),policy)).toBeNull(); });
  it('ritardo urgente solo oltre 15 minuti e non per chi è arrivato', () => { expect(reconfirmationBadge(row,new Date('2026-11-01T11:15:00Z'),policy)?.urgent).toBe(false); expect(reconfirmationBadge(row,new Date('2026-11-01T11:16:00Z'),policy)?.urgent).toBe(true); expect(reconfirmationBadge({...row,arrived:true},new Date('2026-11-01T11:16:00Z'),policy)).toBeNull(); });
  it('ritardo comunicato non segnala il superamento', () => expect(reconfirmationBadge({...row,delay_notified:true},new Date('2026-11-01T11:16:00Z'),policy)?.urgent).toBe(false));
  it('azioni token limitate a consultazione riconferma e disdetta', () => { expect(managementInputSchema.safeParse({token:'non-valido',action:'cancel'}).success).toBe(false); expect(managementInputSchema.safeParse({token:'123e4567-e89b-42d3-a456-426614174000',action:'delete-all'}).success).toBe(false); });
});