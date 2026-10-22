/** Motore di Riorganizzazione Automatica della Sala (logica pura, testata). */
import { canJoin, NO_EXTRAS, type RTable, type Reservation, type TableExtras } from "./data";
import { interval, isRoomClosedFor, type RotationCfg } from "./rotation";

export type ReorgTable = Pick<RTable, "id" | "name" | "seats" | "x" | "y" | "room_id" | "no_join" | "allow_extras"> & {
  coperti_comodi?: number | null;
  coperti_max?: number | null;
  posti_scomodi_solo_in_unione?: boolean | null;
  ordine_riempimento?: number | null;
};
export type ReorgReservation = Pick<Reservation, "id" | "name" | "people" | "time" | "table_ids" | "outside"> & {
  duration_min?: number | null;
  buffer_min?: number | null;
  no_show?: boolean;
  tavolo_bloccato?: boolean | null;
};
type RoomLite = { id: string; environment?: string | null; open_days?: number[] | null; closed_periods?: unknown; closed_shifts?: string[] | null };

export type ReorgMove = { id: string; name: string; people: number; from: string[]; to: string[]; extras: TableExtras };
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
  assignments: Map<string, { ids: string[]; extras: TableExtras }>;
};

/** Confronto lessicografico: true se `a` è strettamente migliore di `b`. */
const lexLess = (a: number[], b: number[]) => {
  for (const [i, v] of a.entries()) if (v !== b[i]) return v < b[i]!;
  return false;
};

const comodi = (t: ReorgTable) => t.coperti_comodi ?? t.seats;
const maxi = (t: ReorgTable) => t.coperti_max ?? t.seats;
const fillOrder = (t: ReorgTable) => t.ordine_riempimento ?? 99;
const scomodiSoloInUnione = (t: ReorgTable) => t.posti_scomodi_solo_in_unione ?? true;

type Occupancy = Map<string, { start: number; free: number }[]>;
const overlaps = (a: { start: number; free: number }, b: { start: number; free: number }) => a.start < b.free && b.start < a.free;
const isFree = (occ: Occupancy, tableId: string, me: { start: number; free: number }) =>
  !(occ.get(tableId) ?? []).some((o) => overlaps(o, me));
const occupy = (occ: Occupancy, tableId: string, me: { start: number; free: number }) => {
  occ.set(tableId, [...(occ.get(tableId) ?? []), me]);
};

/**
 * Riorganizza le prenotazioni di un turno: comitive più grandi prima, tavoli comodi
 * e ordine di riempimento prima, posti scomodi e prolunghe solo come ultima spiaggia.
 */
export function reorganizeService(p: {
  date: string;
  shift: string;
  reservations: ReorgReservation[];
  tables: ReorgTable[];
  rooms: RoomLite[];
  cfg: RotationCfg;
  wallsFor: (roomId: string) => string[];
}): ReorgResult {
  const openRooms = p.rooms.filter((r) => !isRoomClosedFor(r as never, p.date, p.shift));
  const roomOrder = new Map(openRooms.map((r, i) => [r.id, i]));
  const tableById = new Map(p.tables.map((t) => [t.id, t]));
  const occ: Occupancy = new Map();

  const active = p.reservations.filter((r) => !r.no_show);
  const locked = active.filter((r) => r.tavolo_bloccato && r.table_ids.length);
  const toPlace = active
    .filter((r) => !r.tavolo_bloccato)
    .sort((a, b) => b.people - a.people || (a.time || "99").localeCompare(b.time || "99"));

  // I tavoli delle prenotazioni bloccate sono occupati e intoccabili.
  for (const r of locked) {
    const it = interval(r, p.cfg);
    if (isNaN(it.start)) continue;
    for (const id of r.table_ids) occupy(occ, id, it);
  }

  const result: ReorgResult = { moves: [], unchanged: 0, locked: locked.length, unplaced: [], assignments: new Map() };

  const sortTables = (list: ReorgTable[]) =>
    [...list].sort(
      (a, b) =>
        fillOrder(a) - fillOrder(b) ||
        (roomOrder.get(a.room_id) ?? 999) - (roomOrder.get(b.room_id) ?? 999) ||
        a.name.localeCompare(b.name, "it", { numeric: true }),
    );

  /** Unioni contigue nella stessa sala che soddisfano `fits`; ordinate per ordine di riempimento, dimensione, spreco. */
  const unions = (r: ReorgReservation, me: { start: number; free: number }, fits: (combo: ReorgTable[]) => TableExtras | null): { ids: string[]; extras: TableExtras } | null => {
    const zone = zoneRooms(r);
    let best: { ids: string[]; extras: TableExtras; score: number[] } | null = null;
    for (const room of zone) {
      const freeTables = p.tables.filter((t) => t.room_id === room.id && isFree(occ, t.id, me));
      const adjacent = (a: ReorgTable, b: ReorgTable) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
      const visited = new Set<string>();
      const explore = (combo: ReorgTable[], seats: number) => {
        const key = combo.map((t) => t.id).sort().join("|");
        if (visited.has(key)) return;
        visited.add(key);
        const extras = fits(combo);
        if (extras) {
          const score = [combo.reduce((s, t) => s + fillOrder(t), 0), combo.length, Math.max(0, seats - r.people)];
          if (!best || lexLess(score, best.score)) best = { ids: combo.map((t) => t.id), extras, score };
        }
        if (seats >= r.people) return;
        for (const next of freeTables) {
          if (combo.includes(next) || !combo.some((t) => adjacent(t, next)) || !combo.every((t) => canJoin(t, next, p.wallsFor))) continue;
          explore([...combo, next], seats + comodi(next));
        }
      };
      for (const t of freeTables) explore([t], comodi(t));
    }
    return best ? { ids: best.ids, extras: best.extras } : null;
  };

  const zoneRooms = (r: ReorgReservation) => {
    const zone = openRooms.filter((x) => (x.environment === "esterno") === r.outside);
    return zone.length ? zone : openRooms;
  };

  for (const r of toPlace) {
    const me = interval(r, p.cfg);
    if (isNaN(me.start)) { result.unplaced.push(r); continue; }
    const zoneIds = new Set(zoneRooms(r).map((x) => x.id));
    const singles = sortTables(p.tables.filter((t) => zoneIds.has(t.room_id) && isFree(occ, t.id, me)));

    let pick: { ids: string[]; extras: TableExtras } | null = null;
    // PASSAGGIO 1a: tavolo singolo comodo, seguendo l'ordine di riempimento.
    const single = singles.find((t) => comodi(t) >= r.people);
    if (single) pick = { ids: [single.id], extras: NO_EXTRAS };
    // PASSAGGIO 1b: unione di tavoli contigui con la sola capienza comoda.
    if (!pick) pick = unions(r, me, (combo) => (combo.length > 1 && combo.reduce((s, t) => s + comodi(t), 0) >= r.people ? NO_EXTRAS : null));
    // PASSAGGIO 2a: unione sfruttando la capienza estesa (i posti scomodi si attivano in unione).
    if (!pick) pick = unions(r, me, (combo) => (combo.length > 1 && combo.reduce((s, t) => s + maxi(t), 0) >= r.people ? NO_EXTRAS : null));
    // PASSAGGIO 2b: comitive oltre 8 pax — una prolunga per ciascun tavolo abilitato dell'unione.
    if (!pick && r.people > 8)
      pick = unions(r, me, (combo) => {
        const base = combo.reduce((s, t) => s + comodi(t), 0);
        const deficit = r.people - base;
        if (deficit <= 0) return combo.length > 1 ? NO_EXTRAS : null;
        const extendable = combo.filter((t) => t.allow_extras).length;
        return deficit <= extendable ? { ...NO_EXTRAS, extra_sponde: deficit } : null;
      });
    // PASSAGGIO 2c: ultima spiaggia — posti scomodi su tavolo singolo, solo se esplicitamente consentiti.
    if (!pick) {
      const tight = singles.find((t) => !scomodiSoloInUnione(t) && maxi(t) >= r.people);
      if (tight) pick = { ids: [tight.id], extras: NO_EXTRAS };
    }

    if (!pick) { result.unplaced.push(r); continue; }
    for (const id of pick.ids) occupy(occ, id, me);
    const sameIds = pick.ids.length === r.table_ids.length && pick.ids.every((id) => r.table_ids.includes(id));
    const sameExtras = (pick.extras.extra_sponde || 0) === 0;
    if (sameIds && sameExtras) { result.unchanged++; continue; }
    result.moves.push({ id: r.id, name: r.name, people: r.people, from: r.table_ids, to: pick.ids, extras: pick.extras });
    result.assignments.set(r.id, pick);
  }
  return result;
}
