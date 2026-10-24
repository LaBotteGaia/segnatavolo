/** Stato live dei tavoli durante il servizio (Modalità Sala Live). Logica pura (testata). */
import { fmt, interval, toMin, type RotationCfg } from "./rotation";
import type { Reservation, RTable } from "./data";

/** Una prenotazione è "in arrivo" se inizia entro questa finestra (minuti). */
export const SOON_MINUTES = 30;
/** Tolleranza per chi è in ritardo di pochi minuti e non è ancora segnato arrivato. */
export const LATE_GRACE_MINUTES = 15;

export type LiveRes = Pick<Reservation, "id" | "name" | "people" | "time" | "table_ids" | "arrived" | "notes"> & {
  max_stay_until?: string | null;
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

/** Elenchi della colonna arrivi: in arrivo e arrivati/seduti, entrambi ordinati per orario; i no-show spariscono. */
export function arrivalsLists(rows: LiveRes[]): { incoming: LiveRes[]; seated: LiveRes[] } {
  const ok = rows.filter((r) => !r.no_show);
  return {
    incoming: ok.filter((r) => !r.arrived).sort((a, b) => toMin(a.time) - toMin(b.time)),
    seated: ok.filter((r) => r.arrived).sort((a, b) => toMin(a.time) - toMin(b.time)),
  };
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

/* ---------- Incastro con permanenza massima (tavolo prenotato più tardi) ---------- */
/** Margine minimo per proporre la permanenza vincolata. */
export const MIN_LIMITED_STAY = 15;
/** Soglia di allerta del badge "⏳ Max fino alle". */
export const MAX_STAY_ALERT = 15;

/** Prima prenotazione futura (inizio > adesso) su uno qualsiasi dei tavoli indicati. */
export function nextBookingOn(tableIds: string[], rows: LiveRes[], nowMin: number): LiveRes | null {
  let best: LiveRes | null = null;
  for (const r of rows) {
    if (r.no_show || !r.table_ids.some((id) => tableIds.includes(id))) continue;
    const s = toMin(r.time);
    if (isNaN(s) || s <= nowMin) continue;
    if (!best || s < toMin(best.time)) best = r;
  }
  return best;
}

/**
 * Permanenza vincolata: null se la seduta standard (durata + riassetto) sta prima della prossima prenotazione.
 * Altrimenti uscita = prossima − riassetto; `allowed` false se restano meno di 15 minuti.
 */
export function limitedStay(nextStart: number, nowMin: number, cfg: RotationCfg): { untilMin: number; until: string; minutes: number; allowed: boolean } | null {
  if (cfg.duration >= 0 && nowMin + cfg.duration + cfg.buffer <= nextStart) return null;
  const untilMin = nextStart - cfg.buffer;
  const minutes = untilMin - nowMin;
  return { untilMin, until: fmt(untilMin), minutes, allowed: minutes >= MIN_LIMITED_STAY };
}

/** "1h 30m" / "45 min". */
export function hoursMinutes(min: number): string {
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

/** Badge ⏳ per chi ha una permanenza massima; urgent quando mancano meno di 15 minuti. */
export function maxStayBadge(until: string | null | undefined, nowMin: number): { label: string; urgent: boolean } | null {
  const u = toMin(until ?? "");
  if (isNaN(u)) return null;
  const left = Math.max(0, u - nowMin);
  return { label: `⏳ Max fino alle ${until} (${left} min rimanenti)`, urgent: left < MAX_STAY_ALERT };
}
