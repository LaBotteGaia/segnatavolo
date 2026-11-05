import { describe, it, expect } from 'vitest';
import { alternativeSlots, slotCapacity } from '@/lib/online-booking';
const slots = [
 { time: '19:00', remaining: 20, max_table: 6 },
 { time: '19:30', remaining: 20, max_table: 4 },
 { time: '20:00', remaining: 20, max_table: 4 },
 { time: '20:30', remaining: 3, max_table: 8 },
 { time: '21:00', remaining: 20, max_table: 8 },
];
describe('limite tavolo e orari alternativi', () => {
 it('limita i coperti al tavolo libero più grande', () => { expect(slotCapacity(slots[1], 10)).toBe(4); });
 it('limita anche alla capienza residua', () => { expect(slotCapacity(slots[3], 10)).toBe(3); });
 it('propone l’orario precedente e successivo più vicini per 6 persone', () => {
  expect(alternativeSlots(slots, '20:00', 6, 10)).toEqual({ before: '19:00', after: '21:00' });
 });
});
