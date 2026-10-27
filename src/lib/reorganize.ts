/** Motore di Riorganizzazione Automatica della Sala (logica pura, testata). */
import { type RTable, type Reservation, type TableExtras } from "./data";
import { interval, isRoomClosedFor, type RotationCfg } from "./rotation";
import type { ActiveRule } from './custom-rules';
import { calculateBestTableAssignment } from './allocation';
import { DEFAULT_ASSIGNMENT_RULES, type AssignmentRules } from './assignment-rules';

export type ReorgTable = Pick<RTable, "id" | "name" | "seats" | "x" | "y" | "room_id" | "no_join" | "allow_extras"> & {
  coperti_comodi?: number | null;
  coperti_max?: number | null;
  posti_scomodi_solo_in_unione?: boolean | null;
  ordine_riempimento?: number | null;
  accoppiabile?: boolean; adatto_seduta_lunga?: boolean;
};
export type ReorgReservation = Pick<Reservation, "id" | "name" | "people" | "time" | "table_ids" | "outside"> & {
  duration_min?: number | null;
  buffer_min?: number | null;
  no_show?: boolean;
  tavolo_bloccato?: boolean | null;
  notes?: string;
};
type RoomLite = { id: string; environment?: string | null; open_days?: number[] | null; closed_periods?: unknown; closed_shifts?: string[] | null };

export type ReorgMove = { id: string; name: string; people: number; from: string[]; to: string[]; extras: TableExtras; ha_posti_scomodi: boolean };
export type ReorgResult = {
  /** Prenotazioni che cambierebbero tavolo. */
  moves: ReorgMove[];
  /** Prenotazioni già sul tavolo scelto dall'algoritmo. */
  unchanged: number;
  /** Prenotazioni bloccate col lucchetto: restano ferme. */
  locked: number;
  /** Prenotazioni senza posto (overbooking): restano dove sono. */
  unplaced: ReorgReservation[];
  /** Nuova assegnazione per ogni prenotazione spostata. */
  assignments: Map<string, { ids: string[]; extras: TableExtras; ha_posti_scomodi: boolean }>;
};

/**
 * Riorganizza le prenotazioni di un turno: comitive più grandi prima, tavoli comodi
 * e ordine di riempimento prima, posti scomodi e prolunghe solo come ultima spiaggia.
 */
export type ReorgParams = Parameters<typeof reorganizeOnce>[0];

/**
 * Vincolo rigido di non-sovrapposizione: le prenotazioni senza posto restano sui tavoli attuali,
 * quindi il calcolo si ripete considerando quei tavoli occupati finché nessuno viene sovrapposto.
 */
export function reorganizeService(p: ReorgParams): ReorgResult {
  let pinned = new Set<string>();
  let out = reorganizeOnce(p, pinned);
  for (let i = 0; i <= p.reservations.length; i++) {
    const add = out.unplaced.filter((r) => r.table_ids.length && !pinned.has(r.id));
    if (!add.length) break;
    pinned = new Set([...pinned, ...add.map((r) => r.id)]);
    out = reorganizeOnce(p, pinned);
  }
  return out;
}

/** Due intervalli [inizio, fine) sono compatibili solo se max(inizi) >= min(fini). */
export const intervalsCompatible = (a: { start: number; free: number }, b: { start: number; free: number }) => Math.max(a.start, b.start) >= Math.min(a.free, b.free);

function reorganizeOnce(p: {
  date: string;
  shift: string;
  reservations: ReorgReservation[];
  tables: ReorgTable[];
  rooms: RoomLite[];
  cfg: RotationCfg;
  wallsFor: (roomId: string) => string[];
  rules?: AssignmentRules;
  customRules?: ActiveRule[];
}, pinned: Set<string> = new Set()): ReorgResult {
  const openRooms = p.rooms.filter((r) => !isRoomClosedFor(r as never, p.date, p.shift));
  const rules = p.rules ?? DEFAULT_ASSIGNMENT_RULES;
  const placed: ReorgReservation[] = [];

  const active = p.reservations.filter((r) => !r.no_show);
  const locked = active.filter((r) => r.tavolo_bloccato && r.table_ids.length);
  const held = active.filter((r) => !r.tavolo_bloccato && pinned.has(r.id));
  const toPlace = active
    .filter((r) => !r.tavolo_bloccato && !pinned.has(r.id))
    .sort((a, b) => b.people - a.people || (a.time || "99").localeCompare(b.time || "99"));

  // I tavoli delle prenotazioni bloccate sono occupati e intoccabili.
  for (const r of locked) {
    placed.push(r);
  }

  // Prenotazioni in conflitto orario: restano dove sono e tengono occupati i loro tavoli.
  for (const r of held) {
    placed.push(r);
  }

  const result: ReorgResult = { moves: [], unchanged: 0, locked: locked.length, unplaced: [...held], assignments: new Map() };

  for (const r of toPlace) {
    const me = interval(r, p.cfg);
    if (isNaN(me.start)) { result.unplaced.push(r); continue; }
    const pick = calculateBestTableAssignment({ people:r.people,date:p.date,shift:p.shift,time:r.time,tables:p.tables,rooms:openRooms,others:placed,cfg:p.cfg,wallsFor:p.wallsFor,me:r,outside:r.outside,notes:r.notes,rules,customRules:p.customRules });
    if (!pick) { result.unplaced.push(r); continue; }
    placed.push({...r,table_ids:pick.ids});
    const sameIds = pick.ids.length === r.table_ids.length && pick.ids.every((id) => r.table_ids.includes(id));
    const sameExtras = (pick.extras.extra_sponde || 0) === 0;
    if (sameIds && sameExtras) { result.unchanged++; continue; }
    result.moves.push({ id: r.id, name: r.name, people: r.people, from: r.table_ids, to: pick.ids, extras: pick.extras, ha_posti_scomodi:pick.ha_posti_scomodi });
    result.assignments.set(r.id, pick);
  }
  return result;
}
