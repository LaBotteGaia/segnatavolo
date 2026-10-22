import { isShiftClosed, shiftName, type RestaurantSettings, type Room, type RTable, type Shift } from "@/lib/data";
import { doubleShiftActive, isRoomClosedFor } from "@/lib/rotation";

export type Affluence = "green" | "yellow" | "red" | "closed";

type R = Pick<Room, "id" | "open_days" | "closed_periods"> & { closed_shifts?: string[] | null; double_shifts?: unknown };

/** Capienza prenotabile effettiva: posti dei tavoli delle sole sale aperte (raddoppiati se la sala ha il doppio turno attivo) meno il margine di riserva. null = turno chiuso. */
export function bookableCapacity(date: string, shift: Shift, rooms: R[], tables: Pick<RTable, "room_id" | "seats">[], st: Pick<RestaurantSettings, "reserve" | "shifts" | "weekly" | "holidays">): number | null {
  if (st.shifts[shift] && !st.shifts[shift].enabled) return null;
  if (isShiftClosed(date, shift, st as RestaurantSettings)) return null;
  const open = rooms.filter((r) => !isRoomClosedFor(r, date, shift));
  if (!open.length) return null;
  const doubled = new Set(open.filter((r) => doubleShiftActive(r, date, shift)).map((r) => r.id));
  const openIds = new Set(open.map((r) => r.id));
  const seats = tables.filter((t) => openIds.has(t.room_id)).reduce((s, t) => s + t.seats * (doubled.has(t.room_id) ? 2 : 1), 0);
  if (seats <= 0) return null;
  return Math.max(0, seats - Math.max(0, st.reserve));
}

/** Verde < 65%, giallo 65–89%, rosso ≥ 90%. */
export function affluenceLevel(booked: number, capacity: number | null): Affluence {
  if (capacity === null) return "closed";
  if (capacity <= 0) return booked > 0 ? "red" : "red";
  const p = (booked / capacity) * 100;
  if (p < 65) return "green";
  if (p < 90) return "yellow";
  return "red";
}

export function affluenceTip(shift: Shift, booked: number, capacity: number | null) {
  if (capacity === null) return `${shiftName(shift)}: chiuso`;
  const pct = capacity > 0 ? Math.round((booked / capacity) * 100) : 100;
  return `${shiftName(shift)}: ${booked}/${capacity} coperti - ${pct}%`;
}

type ZR = R & { environment?: string | null; is_outdoor?: boolean | null };
const isOut = (r: ZR) => r.is_outdoor ?? r.environment === "esterno";

/** Capienza Interno/Esterno: il margine di riserva si sottrae alle sale interne (o alle esterne se il locale non ne ha di interne aperte). */
export function zoneCapacities(date: string, shift: Shift, rooms: ZR[], tables: Pick<RTable, "room_id" | "seats">[], st: Pick<RestaurantSettings, "reserve" | "shifts" | "weekly" | "holidays">) {
  const zero = { ...st, reserve: 0 };
  let inside = bookableCapacity(date, shift, rooms.filter((r) => !isOut(r)), tables, zero);
  let outside = bookableCapacity(date, shift, rooms.filter(isOut), tables, zero);
  const reserve = Math.max(0, st.reserve);
  if (inside !== null) inside = Math.max(0, inside - reserve);
  else if (outside !== null) outside = Math.max(0, outside - reserve);
  return { inside, outside };
}

const zoneTxt = (label: string, booked: number, cap: number | null) =>
  cap === null ? `${label}: Chiuso` : `${label}: ${booked}/${cap} coperti (${cap > 0 ? Math.round((booked / cap) * 100) : 100}%)`;

/** Es. "Interno: 32/45 coperti (71%) | Esterno: Chiuso". */
export function zoneTip(inBooked: number, inCap: number | null, outBooked: number, outCap: number | null) {
  return `${zoneTxt("Interno", inBooked, inCap)} | ${zoneTxt("Esterno", outBooked, outCap)}`;
}
