/** Rotazione tavoli, aperture stagionali delle sale e riepilogo disponibilità. Logica pura (testata). */
import type { Ranges, Room, Reservation, RTable, Shift } from "./data";

export const DEFAULT_DURATION = 90;
export const DEFAULT_BUFFER = 15;
/** duration_min = -1 → "Tutta la sera / No rotazione". */
export const WHOLE_EVENING = -1;
export const DURATION_PRESETS = [75, 90, 105, 120];

export const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
export const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const durLabel = (d: number) => (d < 0 ? "Tutta la sera" : `${Math.floor(d / 60)}h ${String(d % 60).padStart(2, "0")}m`);

export type RotationCfg = { duration: number; buffer: number };
type Slot = Pick<Reservation, "time"> & { duration_min?: number | null; buffer_min?: number | null };

/** Intervallo occupato: [start, end) seduti, poi buffer fino a `free`. */
export function interval(r: Slot, cfg: RotationCfg) {
  const start = toMin(r.time);
  const d = r.duration_min ?? cfg.duration;
  const b = r.buffer_min ?? cfg.buffer;
  if (d < 0) return { start, end: 24 * 60, free: 24 * 60 };
  return { start, end: start + d, free: start + d + b };
}

type Other = Slot & Pick<Reservation, "id" | "name" | "table_ids"> & { no_show?: boolean };
export type TableState =
  | { kind: "free" }
  | { kind: "busy"; until: string; name: string }
  | { kind: "limited"; until: string };

/** Stato di un tavolo per una prenotazione che inizia a `time` con la sua durata/buffer. */
export function tableState(tableId: string, me: Slot & { id: string }, others: Other[], cfg: RotationCfg): TableState {
  const mine = interval(me, cfg);
  if (isNaN(mine.start)) {
    const o = others.find((x) => !x.no_show && x.id !== me.id && x.table_ids.includes(tableId));
    return o ? { kind: "busy", until: "—", name: o.name } : { kind: "free" };
  }
  let limit = Infinity;
  for (const o of others) {
    if (o.no_show || o.id === me.id || !o.table_ids.includes(tableId)) continue;
    const it = interval(o, cfg);
    if (isNaN(it.start)) return { kind: "busy", until: "—", name: o.name };
    if (mine.start < it.free && it.start < mine.free) return { kind: "busy", until: it.free >= 24 * 60 ? "fine serata" : fmt(it.free), name: o.name };
    if (it.start >= mine.free) limit = Math.min(limit, it.start - (me.buffer_min ?? cfg.buffer));
  }
  return limit < Infinity ? { kind: "limited", until: fmt(limit) } : { kind: "free" };
}

/** Etichetta rotazione accanto al tavolo in agenda: " (fino 21:30)" / " (dalle 21:45)". */
export function rotationNote(r: Slot & Pick<Reservation, "id" | "table_ids">, others: Other[], cfg: RotationCfg) {
  if (!r.table_ids.length) return "";
  const me = interval(r, cfg);
  if (isNaN(me.start)) return "";
  const share = others.filter((o) => !o.no_show && o.id !== r.id && o.table_ids.some((t) => r.table_ids.includes(t))).map((o) => interval(o, cfg)).filter((i) => !isNaN(i.start));
  if (share.some((i) => i.start >= me.end)) return ` (fino ${fmt(me.end)})`;
  if (share.some((i) => i.start < me.start)) return ` (dalle ${r.time})`;
  return "";
}

/* ---------- Apertura stagionale/settimanale delle sale ---------- */
export type ClosedPeriod = { from: string; to: string }; // "MM-DD", ricorrente ogni anno
export const periodsOf = (room: Partial<Pick<Room, "closed_periods">> | undefined): ClosedPeriod[] =>
  Array.isArray(room?.closed_periods) ? (room!.closed_periods as ClosedPeriod[]).filter((p) => p && p.from && p.to) : [];

/** La sala è chiusa nella data (yyyy-MM-dd)? Periodi che scavalcano l'anno (01/11 → 31/03) inclusi. */
export function isRoomClosed(room: Partial<Pick<Room, "open_days" | "closed_periods">> | undefined, date: string): boolean {
  if (!room) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y!, m! - 1, d!).getDay();
  if (Array.isArray(room.open_days) && !room.open_days.includes(dow)) return true;
  const md = date.slice(5);
  return periodsOf(room).some((p) => (p.from <= p.to ? md >= p.from && md <= p.to : md >= p.from || md <= p.to));
}

/** Sala chiusa per stagione quel giorno oppure disattivata per il turno. */
export function isRoomClosedFor(room: (Partial<Pick<Room, "open_days" | "closed_periods">> & { closed_shifts?: string[] | null }) | undefined, date: string, shift: string): boolean {
  return isRoomClosed(room, date) || !!room?.closed_shifts?.includes(shift);
}

/** Tutte le sale esterne sono chiuse quel giorno (o non ce ne sono)? */
export function outsideClosed(rooms: Pick<Room, "environment" | "open_days" | "closed_periods">[], date: string) {
  const ext = rooms.filter((r) => r.environment === "esterno");
  return ext.length > 0 && ext.every((r) => isRoomClosed(r, date));
}

/* ---------- Riepilogo disponibilità del turno ---------- */
export type Availability = {
  free: RTable[];
  first: { t: RTable; until: string }[];
  second: { t: RTable; from: string }[];
  full: RTable[];
};

export function shiftAvailability(tables: RTable[], rows: Other[], shift: Shift, ranges: Ranges, cfg: RotationCfg): Availability {
  const open = toMin(ranges[shift].from), last = toMin(ranges[shift].to);
  const out: Availability = { free: [], first: [], second: [], full: [] };
  for (const t of tables) {
    const its = rows.filter((r) => !r.no_show && r.table_ids.includes(t.id)).map((r) => interval(r, cfg)).filter((i) => !isNaN(i.start)).sort((a, b) => a.start - b.start);
    if (!its.length) { out.free.push(t); continue; }
    let any = false;
    const until = its[0]!.start - cfg.buffer;
    if (until - open >= cfg.duration) { out.first.push({ t, until: fmt(until) }); any = true; }
    const from = Math.max(...its.map((i) => i.free));
    if (from <= last) { out.second.push({ t, from: fmt(from) }); any = true; }
    if (!any) out.full.push(t);
  }
  return out;
}
