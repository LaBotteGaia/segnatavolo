/** Stato live dei tavoli durante il servizio (Modalità Sala Live). Logica pura (testata). */
import { fmt, interval, toMin, type RotationCfg } from "./rotation";
import type { Reservation, RTable } from "./data";

/** Una prenotazione è "in arrivo" se inizia entro questa finestra (minuti). */
export const SOON_MINUTES = 30;
/** Tolleranza per chi è in ritardo di pochi minuti e non è ancora segnato arrivato. */
export const LATE_GRACE_MINUTES = 15;

type LiveRes = Pick<Reservation, "id" | "name" | "people" | "time" | "table_ids" | "arrived"> & {
  duration_min?: number | null;
  buffer_min?: number | null;
  no_show?: boolean;
};

export type LiveTableState =
  | { kind: "free" }
  | { kind: "seated"; res: LiveRes; sinceMin: number; until: string }
  | { kind: "incoming"; res: LiveRes; at: string };

/** Stato live di un tavolo all'orario `nowMin` (minuti da mezzanotte): seduto > in arrivo > libero. */
export function liveTableState(tableId: string, rows: LiveRes[], nowMin: number, cfg: RotationCfg, soon: number = SOON_MINUTES): LiveTableState {
  let incoming: { res: LiveRes; at: string; start: number } | null = null;
  for (const r of rows) {
    if (r.no_show || !r.table_ids.includes(tableId)) continue;
    const it = interval(r, cfg);
    if (isNaN(it.start)) continue;
    if (r.arrived && nowMin >= it.start && nowMin < it.free) {
      return { kind: "seated", res: r, sinceMin: nowMin - it.start, until: it.free >= 24 * 60 ? "fine serata" : fmt(it.free) };
    }
    if (!r.arrived && it.start >= nowMin - LATE_GRACE_MINUTES && it.start <= nowMin + soon) {
      if (!incoming || it.start < incoming.start) incoming = { res: r, at: r.time, start: it.start };
    }
  }
  return incoming ? { kind: "incoming", res: incoming.res, at: incoming.at } : { kind: "free" };
}

/** Contatori sintetici della barra superiore: coperti seduti, tavoli liberi, tavoli in arrivo. */
export function liveCounters(tables: Pick<RTable, "id">[], rows: LiveRes[], nowMin: number, cfg: RotationCfg) {
  let seatedCovers = 0, freeTables = 0, incomingTables = 0;
  for (const t of tables) {
    const st = liveTableState(t.id, rows, nowMin, cfg);
    if (st.kind === "seated") seatedCovers += st.res.people;
    else if (st.kind === "incoming") incomingTables++;
    else freeTables++;
  }
  return { seatedCovers, freeTables, incomingTables };
}

/** "Seduti da 45 min" / "Seduti da 1h 20m". */
export function seatedSinceLabel(min: number): string {
  if (min < 60) return `Seduti da ${min} min`;
  return `Seduti da ${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

/** Spostamento rapido: sostituisce il tavolo `from` con `to` dentro l'elenco assegnato, preservando le eventuali unioni. */
export function movedTableIds(ids: string[], from: string, to: string): string[] {
  return ids.map((id) => (id === from ? to : id));
}

/** Scambio rapido: inverte i due tavoli tra le due comitive. */
export function swappedTableIds(aIds: string[], bIds: string[], aTable: string, bTable: string): { a: string[]; b: string[] } {
  return { a: movedTableIds(aIds, aTable, bTable), b: movedTableIds(bIds, bTable, aTable) };
}

/** Minuti da mezzanotte di "HH:MM"; NaN se non valido. */
export { toMin };
