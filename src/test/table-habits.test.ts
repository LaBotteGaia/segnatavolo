import { describe, it, expect } from 'vitest';
import { learnHabits, habitScore } from '@/lib/table-habits';
import { arrivalCountdown } from '@/lib/live-floor';

describe('apprendimento 30 giorni', () => {
  const rows = [
    { date: '2026-10-25', shift: 'cena', people: 2, table_ids: ['b'] },
    { date: '2026-10-28', shift: 'cena', people: 2, table_ids: ['b'] },
    { date: '2026-09-15', shift: 'cena', people: 2, table_ids: ['a'] },
    { date: '2026-09-16', shift: 'cena', people: 2, table_ids: ['a'] },
  ];
  it('conta solo le scelte negli ultimi 30 giorni', () => {
    const h = learnHabits(rows, '2026-11-01');
    expect(habitScore(h, 'cena', 2, ['b'])).toBe(2);
    expect(habitScore(h, 'cena', 2, ['a'])).toBe(0);
  });
  it('ignora una scelta isolata', () => {
    const h = learnHabits([rows[0]!], '2026-11-01');
    expect(habitScore(h, 'cena', 2, ['b'])).toBe(0);
  });
});

describe('conto alla rovescia Sala Live', () => {
  it('rosso sotto 15 minuti, ambra sotto 30', () => {
    expect(arrivalCountdown(1200, 1190)?.tone).toBe('urgent');
    expect(arrivalCountdown(1200, 1175)?.tone).toBe('soon');
    expect(arrivalCountdown(1200, 1100)?.tone).toBe('later');
    expect(arrivalCountdown(1200, 1210)?.tone).toBe('late');
  });
});
