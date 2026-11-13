import { describe, expect, it } from 'vitest';
import { mergeRepeats, normalizePhotoResult, normTime, samePerson } from '@/lib/agenda-photo';

describe('foto agenda', () => {
  it('converte orari scritti a mano', () => {
    expect(normTime('2045')).toBe('20:45'); expect(normTime('21.00')).toBe('21:00'); expect(normTime('1915')).toBe('19:15'); expect(normTime('PX')).toBeNull();
  });
  it('orario illeggibile resta incerto, non inventato', () => {
    const r = normalizePhotoResult({ date: '2026-11-13', shift: 'sera', rows: [{ name: 'La Cava', people: 13, time: 'PX', phone: null }] });
    expect(r.rows[0]?.time).toBeNull(); expect(r.rows[0]?.uncertain).toContain('time');
  });
  it('identità per telefono normalizzato, non per nome', () => {
    expect(samePerson({ name: 'Mario', phone: '349 553-3966', time: '20:00' }, { name: 'Gentili', phone: '+393495533966', time: '21:00' })).toBe(true);
    expect(samePerson({ name: 'Mario Rossi', phone: '3491111111', time: '20:00' }, { name: 'Mario Rossi', phone: '3492222222', time: '20:00' })).toBe(false);
  });
  it('unisce le ripetizioni nella stessa foto completando i dati', () => {
    const rows = normalizePhotoResult({ rows: [{ name: 'Gentili', people: 5, time: null, phone: '3495543966' }, { name: 'Gentili', people: 5, time: '20:00', phone: '349 5543966' }] }).rows;
    const m = mergeRepeats(rows);
    expect(m).toHaveLength(1); expect(m[0]?.time).toBe('20:00'); expect(m[0]?.uncertain).not.toContain('time');
  });
  it('cancellatura solo se dichiarata dal tratto di penna', () => {
    const r = normalizePhotoResult({ rows: [{ name: 'Chiara', people: 5, time: '20:30' }] });
    expect(r.rows[0]?.crossed_out).toBe(false);
  });
});

import { findCustomerMatch } from '@/lib/agenda-photo';
describe('findCustomerMatch', () => {
  const book = [{ id: 'a', name: 'Carlotta Berti', phone: '335 6249037' }, { id: 'b', name: 'Michele', phone: '3406042868' }, { id: 'c', name: 'Michele', phone: '3330000000' }];
  it('riconosce per telefono normalizzato', () => expect(findCustomerMatch(book, 'Carlotta', '335-624-9037')?.customer.id).toBe('a'));
  it('nome senza telefono solo se univoco', () => { expect(findCustomerMatch(book, 'berti carlotta', '')?.by).toBe('name'); expect(findCustomerMatch(book, 'Michele', '')).toBeNull(); });
  it('telefono sconosciuto = nuovo cliente', () => expect(findCustomerMatch(book, 'Carlotta Berti', '3999999999')).toBeNull());
});
