import { reorganizeService, type ReorgParams } from './reorganize';

/** Reuse the shared engine while explicitly dropping outdoor preferences and closed tables. */
export function weatherReorganization(p: Omit<ReorgParams,'rooms'> & { rooms: (ReorgParams['rooms'][number] & { is_outdoor?: boolean })[] }) {
  const rooms = p.rooms.filter(r => !r.is_outdoor && r.environment !== 'esterno');
  const reservations = p.reservations.map(r => ({ ...r, outside:false }));
  const result = reorganizeService({ ...p, reservations, rooms, tables:p.tables.filter(t => rooms.some(r => r.id === t.room_id)) });
  const unplaced = new Set(result.unplaced.map(r => r.id));
  const plan = reservations.filter(r => !r.no_show && !r.tavolo_bloccato).map(r => {
    const a = result.assignments.get(r.id);
    return { id:r.id, ids:unplaced.has(r.id) ? [] : a?.ids ?? r.table_ids, extra_sponde:a?.extras.extra_sponde ?? 0, ha_posti_scomodi:a?.ha_posti_scomodi ?? false };
  });
  return { result, plan };
}