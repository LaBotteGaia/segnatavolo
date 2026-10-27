import { confirmedBooking } from "./online-booking";
import { normalizeAssignmentRules, DEFAULT_ASSIGNMENT_RULES, type AssignmentRules } from './assignment-rules';
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { activeRules } from "./custom-rules";
import { supabase } from "@/integrations/supabase/client";
import { scopeRestaurant, useActiveRestaurantId } from "@/lib/tenant";
import type { Tables } from "@/integrations/supabase/types";

export type Room = Tables<"rooms">;
export type RTable = Tables<"restaurant_tables">;
export type Customer = Tables<"customers">;
export type Reservation = Tables<"reservations">;
export type Shift = "colazione" | "pranzo" | "sera";
export const ALL_SHIFTS: Shift[] = ["colazione", "pranzo", "sera"];

export const roomsQuery = (restaurantId: string | null = null) => ({
  queryKey: ["rooms", restaurantId],
  enabled: !!restaurantId,
  queryFn: async () => {
    const { data, error } = await scopeRestaurant(supabase.from("rooms").select("*"), restaurantId).order("sort_order").order("created_at");
    if (error) throw error;
    return data;
  },
});

export const tablesQuery = (restaurantId: string | null = null) => ({
  queryKey: ["tables", restaurantId],
  enabled: !!restaurantId,
  queryFn: async () => {
    const { data, error } = await scopeRestaurant(supabase.from("restaurant_tables").select("*"), restaurantId);
    if (error) throw error;
    return [...data].sort((a, b) => compareTableNames(a.name, b.name));
  },
});

/** Ordine naturale dei tavoli: prima i nomi solo numerici (1, 2, 10), poi lettere/nomi in ordine alfabetico. */
export function compareTableNames(a: string, b: string) {
  const na = /^\s*\d+\s*$/.test(a), nb = /^\s*\d+\s*$/.test(b);
  if (na && nb) return Number(a) - Number(b);
  if (na !== nb) return na ? -1 : 1;
  return a.trim().localeCompare(b.trim(), "it", { numeric: true, sensitivity: "base" });
}

/** Confronta tavoli: prima l'ordine delle sale configurato, poi l'ordine naturale del nome. */
export function compareTables(rooms: { id: string }[] | undefined) {
  const idx = new Map((rooms ?? []).map((r, i) => [r.id, i]));
  return (a: { room_id: string; name: string }, b: { room_id: string; name: string }) =>
    (idx.get(a.room_id) ?? 999) - (idx.get(b.room_id) ?? 999) || compareTableNames(a.name, b.name);
}

export const customersQuery = (restaurantId: string | null = null) => ({
  queryKey: ["customers", restaurantId],
  enabled: !!restaurantId,
  queryFn: async () => {
    const { data, error } = await scopeRestaurant(supabase.from("customers").select("*"), restaurantId).order("name");
    if (error) throw error;
    return data;
  },
});

export const reservationsQuery = (date: string, restaurantId: string | null = null) => ({
  queryKey: ["reservations", date, restaurantId],
  enabled: !!restaurantId,
  queryFn: async () => {
    const { data, error } = await scopeRestaurant(supabase.from("reservations").select("*"), restaurantId).is("deleted_at", null).eq("status", "confirmed").eq("date", date);
    if (error) throw error;
    return data;
  },
});

export const customRulesQuery = (restaurantId: string | null = null) => ({
  queryKey: ["custom-rules", restaurantId],
  enabled: !!restaurantId,
  queryFn: async () => {
    const { data, error } = await scopeRestaurant(supabase.from("restaurant_assignment_rules").select("*"), restaurantId).order("created_at");
    if (error) throw error;
    return data;
  },
});
export function useCustomRules() {
  return useQuery(customRulesQuery(useActiveRestaurantId()));
}
/** Regole personalizzate attive e valide, pronte per suggerimenti e riorganizzazione. */
export function useActiveCustomRules() {
  const { data } = useCustomRules();
  const restaurantId = useActiveRestaurantId();
  return useMemo(() => restaurantId ? activeRules(data, restaurantId) : [], [data, restaurantId]);
}

export function useRooms() {
  return useQuery(roomsQuery(useActiveRestaurantId()));
}
export function useTables() {
  return useQuery(tablesQuery(useActiveRestaurantId()));
}
export function useCustomers() {
  return useQuery(customersQuery(useActiveRestaurantId()));
}
export function useReservations(date: string) {
  return useQuery(reservationsQuery(date, useActiveRestaurantId()));
}

export function findCustomer(customers: Customer[] | undefined, name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return customers?.find((c) => c.name.trim().toLowerCase() === n);
}

/** Totals for a shift page header. */
export function shiftCounters(rows: (Pick<Reservation, "people" | "outside" | "arrived"> & { no_show?: boolean; status?: string })[]) {
  let total = 0, inside = 0, outside = 0, pending = 0;
  for (const r of rows) {
    if (!confirmedBooking(r) || (r.no_show && !r.arrived)) continue;
    total += r.people;
    if (r.outside) outside += r.people;
    else inside += r.people;
    if (!r.arrived) pending += r.people;
  }
  return { total, inside, outside, pending };
}

export function tableLabel(ids: string[], tables: RTable[] | undefined, rooms: Room[] | undefined) {
  if (!ids.length || !tables) return "";
  const byRoom = new Map<string, string[]>();
  const picked = ids.map((id) => tables.find((x) => x.id === id)).filter((t): t is RTable => !!t).sort(compareTables(rooms));
  for (const t of picked) {
    const list = byRoom.get(t.room_id) ?? [];
    list.push(t.name);
    byRoom.set(t.room_id, list);
  }
  return [...byRoom.entries()]
    .map(([rid, names]) => `${rooms?.find((r) => r.id === rid)?.name ?? "Sala"}: ${names.join("+")}`)
    .join(" · ");
}

export function whatsappLink(phone: string, r: { name: string; date: string; time: string; people: number }) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (!digits.startsWith("39") || digits.length <= 10) {
    if (digits.length >= 9 && digits.length <= 10) digits = "39" + digits;
  }
  const [y, m, d] = r.date.split("-");
  const text = `Buongiorno ${r.name}, le confermiamo la prenotazione per ${r.people} ${r.people === 1 ? "persona" : "persone"} il giorno ${d}/${m}/${y} alle ore ${r.time}. A presto!`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Allowed booking windows per shift (inclusive, HH:MM). */
export type Ranges = Record<Shift, { from: string; to: string }>;
export const SHIFT_RANGES: Ranges = {
  colazione: { from: "07:30", to: "10:30" },
  pranzo: { from: "12:00", to: "14:30" },
  sera: { from: "19:00", to: "23:00" },
};

const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return NaN;
  const h = Number(m[1]), mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : NaN;
};

/** 15-minute slots inside a shift window. */
export function timeSlots(shift: Shift, ranges: Ranges = SHIFT_RANGES): string[] {
  const out: string[] = [];
  for (let m = toMin(ranges[shift].from); m <= toMin(ranges[shift].to); m += 15)
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
}

export function shiftForTime(time: string, ranges: Ranges = SHIFT_RANGES, shifts: Shift[] = ["pranzo", "sera"]): Shift | null {
  const m = toMin(time);
  for (const s of ALL_SHIFTS.filter((x) => shifts.includes(x)))
    if (m >= toMin(ranges[s].from) && m <= toMin(ranges[s].to)) return s;
  return null;
}

export type ReservationErrors = Partial<Record<"name" | "people" | "date" | "time", string>>;

/** Blocking checks before saving a reservation. */
export function validateReservation(v: { name: string; people: string | number | null; date: string; time: string; shift: Shift }, ranges: Ranges = SHIFT_RANGES): ReservationErrors {
  const e: ReservationErrors = {};
  if (!v.name.trim()) e.name = "Inserisci il nome del cliente";
  const p = typeof v.people === "number" ? v.people : v.people === null || String(v.people).trim() === "" ? NaN : Number(v.people);
  if (!Number.isInteger(p) || p < 1) e.people = "Inserisci almeno 1 persona";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || isNaN(Date.parse(v.date))) e.date = "Seleziona una data valida";
  if (shiftForTime(v.time, ranges, [v.shift]) !== v.shift) {
    const r = ranges[v.shift];
    e.time = `Seleziona un orario valido tra le ${r.from} e le ${r.to}`;
  }
  return e;
}

export const shiftName = (s: Shift | string) => (s === "pranzo" ? "Pranzo" : s === "colazione" ? "Colazione" : "Cena");
export const shiftPlural = (s: Shift | string) => (s === "pranzo" ? "Pranzi" : s === "colazione" ? "Colazioni" : "Cene");
export const shiftEmoji = (s: Shift | string) => (s === "pranzo" ? "📖" : s === "colazione" ? "☕" : "🌙");
const shiftOf = (s: Shift) => (s === "pranzo" ? "del Pranzo" : s === "colazione" ? "della Colazione" : "della Cena");
const shiftArticle = (s: Shift) => (s === "pranzo" ? "il pranzo" : s === "colazione" ? "la colazione" : "la cena");

/** "2100" → "21:00", "9:5" → "09:05"; anything unparseable is returned as typed. */
export function normalizeTime(raw: string): string {
  const t = raw.trim();
  const digits = /^\d{1,4}$/.test(t) ? (t.length <= 2 ? t + ":00" : t.slice(0, -2) + ":" + t.slice(-2)) : t;
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(digits);
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]!.padStart(2, "0")}` : t;
}

export type TimeCommit =
  | { kind: "save"; time: string }
  | { kind: "revert"; error: string }
  | { kind: "move"; time: string; shift: Shift; message: string; actionLabel: string };

/** Check a time typed directly into an agenda row against the row's shift window. */
export function commitTimeCheck(typed: string, shift: Shift | string, ranges: Ranges = SHIFT_RANGES, active: Shift[] = ["pranzo", "sera"]): TimeCommit {
  const sh: Shift = shift === "pranzo" || shift === "colazione" ? shift : "sera";
  const t = normalizeTime(typed);
  const w = ranges[sh];
  if (!t) return { kind: "revert", error: `Inserisci un orario: per ${shiftArticle(sh)} scegli un orario tra le ${w.from} e le ${w.to}` };
  const s = shiftForTime(t, ranges, [...new Set([sh, ...active])]);
  if (!s) return { kind: "revert", error: `Orario non valido: per ${shiftArticle(sh)} scegli un orario tra le ${w.from} e le ${w.to}` };
  if (s !== sh)
    return {
      kind: "move",
      time: t,
      shift: s,
      message: `Le ${t} sono un orario ${shiftOf(s)}. Spostarla in ${shiftName(s)}?`,
      actionLabel: `Sposta in ${shiftName(s)}`,
    };
  return { kind: "save", time: t };
}

/* ---------- Capienza e disponibilità ---------- */
export type Environment = "interno" | "esterno";
export type DotLevel = "white" | "green" | "yellow" | "red" | "black" | "off";

/** Capienza di una sala: valore impostato oppure somma dei posti dei suoi tavoli. */
export function roomCapacity(room: Pick<Room, "id" | "capacity">, tables: Pick<RTable, "room_id" | "seats">[]): number {
  if (room.capacity !== null && room.capacity !== undefined) return room.capacity;
  return tables.filter((t) => t.room_id === room.id).reduce((s, t) => s + t.seats, 0);
}

/** La sala è disattivata per quel turno (es. dehors chiuso a cena)? */
export const roomShiftOff = (room: { closed_shifts?: string[] | null } | undefined, shift: Shift | string) => !!room?.closed_shifts?.includes(shift);

export function totalCapacities(rooms: (Pick<Room, "id" | "capacity" | "environment"> & { closed_shifts?: string[] | null })[], tables: Pick<RTable, "room_id" | "seats">[], shift?: Shift) {
  let inside = 0, outside = 0;
  for (const r of rooms) {
    if (shift && roomShiftOff(r, shift)) continue;
    const c = roomCapacity(r, tables);
    if (r.environment === "esterno") outside += c;
    else inside += c;
  }
  return { inside, outside };
}

/** Colore del pallino dato coperti prenotati e capienza. */
export function dotLevel(people: number, capacity: number): DotLevel {
  if (capacity <= 0) return "off";
  if (people <= 0) return "white";
  const p = (people / capacity) * 100;
  if (p < 50) return "green";
  if (p < 90) return "yellow";
  if (p < 100) return "red";
  return "black";
}

/** Pallini interno/esterno di un giorno, sul turno più occupato. */
type Cap = { inside: number; outside: number };
const DOT_ORDER: DotLevel[] = ["off", "white", "green", "yellow", "red", "black"];
/** Pallini interno/esterno di un giorno: livello del turno più pieno, con capienza specifica per turno se fornita. */
export function dayDots(rows: (Pick<Reservation, "people" | "outside" | "shift"> & { no_show?: boolean })[], cap: Cap | ((s: Shift) => Cap)) {
  const capOf = typeof cap === "function" ? cap : () => cap;
  const level = (outside: boolean) => {
    const levels = (["pranzo", "sera"] as const).map((s) => {
      const c = outside ? capOf(s).outside : capOf(s).inside;
      return dotLevel(rows.filter((r) => !r.no_show && r.shift === s && r.outside === outside).reduce((a, r) => a + r.people, 0), c);
    });
    return levels.reduce((a, b) => (DOT_ORDER.indexOf(b) > DOT_ORDER.indexOf(a) ? b : a));
  };
  return { inside: level(false), outside: level(true) };
}

export const monthReservationsQuery = (from: string, to: string, restaurantId: string | null = null) => ({
  queryKey: ["reservations-month", from, to, restaurantId],
  enabled: !!restaurantId,
  queryFn: async () => {
    const { data, error } = await scopeRestaurant(supabase.from("reservations").select("date, shift, people, outside, no_show"), restaurantId).is("deleted_at", null).eq("status", "confirmed").gte("date", from).lte("date", to);
    if (error) throw error;
    return data;
  },
});

/* ---------- Impostazioni ristorante: turni e chiusure ---------- */
export type ShiftCfg = { enabled: boolean; from: string; to: string };
export type Holiday = { from: string; to: string };
export type RestaurantSettings = {
  shifts: Record<Shift, ShiftCfg>;
  /** giorno settimana (0 = domenica) → turni chiusi */
  weekly: Record<string, Shift[]>;
  holidays: Holiday[];
  /** durata standard tavolo e margine riallestimento, in minuti */
  duration: number;
  buffer: number;
  /** Modalità Privacy al banco: maschera i telefoni a schermo */
  privacy: boolean;
  /** Numeri completi sul Foglio di Sala stampato */
  printPhones: boolean;
  /** Coperti di riserva (margine di sala) sottratti dalla capienza prenotabile */
  reserve: number;
  /** Riorganizzazione intelligente della sala (pulsante a fondo turno) */
  reorganize: boolean;
  assignmentRules: AssignmentRules;
};

export const DEFAULT_SETTINGS: RestaurantSettings = {
  shifts: {
    colazione: { enabled: false, from: "07:30", to: "10:30" },
    pranzo: { enabled: true, from: "12:00", to: "14:30" },
    sera: { enabled: true, from: "19:00", to: "23:00" },
  },
  weekly: {},
  holidays: [],
  duration: 90,
  buffer: 15,
  privacy: true,
  printPhones: false,
  reserve: 4,
  reorganize: true,
  assignmentRules: DEFAULT_ASSIGNMENT_RULES,
};

export function normalizeSettings(raw: unknown): RestaurantSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<RestaurantSettings>;
  const shifts = { ...DEFAULT_SETTINGS.shifts };
  for (const s of ALL_SHIFTS) if (r.shifts?.[s]) shifts[s] = { ...shifts[s], ...r.shifts[s] };
  return { shifts, weekly: r.weekly ?? {}, holidays: Array.isArray(r.holidays) ? r.holidays : [], duration: typeof r.duration === "number" ? r.duration : 90, buffer: typeof r.buffer === "number" ? r.buffer : 15, privacy: typeof r.privacy === "boolean" ? r.privacy : true, printPhones: r.printPhones === true, reserve: typeof r.reserve === "number" && r.reserve >= 0 ? Math.floor(r.reserve) : 4, reorganize: r.reorganize !== false, assignmentRules: normalizeAssignmentRules(r.assignmentRules) };
}

export const rangesOf = (st: RestaurantSettings): Ranges =>
  Object.fromEntries(ALL_SHIFTS.map((s) => [s, { from: st.shifts[s].from, to: st.shifts[s].to }])) as Ranges;
export const activeShifts = (st: RestaurantSettings) => ALL_SHIFTS.filter((s) => st.shifts[s].enabled);

/** Turni chiusi in una data (yyyy-MM-dd): riposo settimanale o ferie. */
export function closedShifts(date: string, st: RestaurantSettings): Shift[] {
  if (st.holidays.some((h) => h.from && h.to && date >= h.from && date <= h.to)) return [...ALL_SHIFTS];
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y!, m! - 1, d!).getDay();
  return st.weekly[String(dow)] ?? [];
}
export const isShiftClosed = (date: string, shift: Shift, st: RestaurantSettings) => closedShifts(date, st).includes(shift);
/** Giorno chiuso = tutti i turni attivi sono chiusi. */
export function isDayClosed(date: string, st: RestaurantSettings) {
  const c = closedShifts(date, st);
  const act = activeShifts(st);
  return act.length > 0 && act.every((s) => c.includes(s));
}

/* ---------- Riga compatta ---------- */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export type ZoneMismatch = "interno-per-esterno" | "esterno-per-interno" | null;
/** Incongruenza tra zona richiesta (Fuori) e tipologia delle sale dei tavoli assegnati. */
export function zoneMismatch(
  r: Pick<Reservation, "outside" | "table_ids">,
  tables: Pick<RTable, "id" | "room_id">[] | undefined,
  rooms: Pick<Room, "id" | "environment">[] | undefined,
): ZoneMismatch {
  if (!r.table_ids.length || !tables || !rooms) return null;
  for (const id of r.table_ids) {
    const t = tables.find((x) => x.id === id);
    const env = rooms.find((x) => x.id === t?.room_id)?.environment;
    if (!env) continue;
    if (r.outside && env !== "esterno") return "interno-per-esterno";
    if (!r.outside && env === "esterno") return "esterno-per-interno";
  }
  return null;
}
export const mismatchText = (m: ZoneMismatch) =>
  m === "interno-per-esterno" ? "Incongruenza: tavolo Interno per richiesta Esterno" : m ? "Incongruenza: tavolo Esterno per richiesta Interno" : "";

// --- Sponde / Barelle (posti extra) ---
export type TableExtras = { extra_sponde: number; extra_barelle: number; barella_seats: number };
export const NO_EXTRAS: TableExtras = { extra_sponde: 0, extra_barelle: 0, barella_seats: 2 };
export const extraSeats = (e: TableExtras) => Math.max(0, e.extra_sponde) + Math.max(0, e.extra_barelle) * (e.barella_seats || 0);
export function extrasText(e: Partial<TableExtras>) {
  const s = e.extra_sponde ?? 0, b = e.extra_barelle ?? 0;
  const parts: string[] = [];
  if (s > 0) parts.push(`+${s} ${s === 1 ? "Sponda" : "Sponde"}`);
  if (b > 0) parts.push(`+${b} ${b === 1 ? "Barella" : "Barelle"}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

// --- Pareti: "h:x:y" = muro orizzontale sul bordo superiore della cella (x,y); "v:x:y" = muro verticale sul bordo sinistro ---
export function wallsOf(room: Pick<Room, "walls"> | undefined): string[] {
  const w = room?.walls;
  return Array.isArray(w) ? (w.filter((k) => typeof k === "string") as string[]) : [];
}
export const toggleWall = (walls: string[], key: string) => (walls.includes(key) ? walls.filter((k) => k !== key) : [...walls, key]);

// --- Ostacoli: "o:x:y" nella stessa lista delle pareti = cella non utilizzabile (colonna, pilastro, albero…) ---
export const obstacleKey = (x: number, y: number) => `o:${x}:${y}`;
export const isObstacle = (walls: string[], x: number, y: number) => walls.includes(obstacleKey(x, y));

// --- Telefono come chiave univoca del cliente ---
export const normPhone = (p: string | null | undefined) => (p ?? "").replace(/[\s\-.\/()]/g, "");
export function findCustomerByPhone(customers: Customer[] | undefined, phone: string) {
  const n = normPhone(phone);
  if (n.length < 5) return undefined;
  return customers?.find((c) => normPhone(c.phone) === n);
}

// --- Dimensioni griglia e vincoli tra tavoli ---
export const gridOf = (room: Partial<Pick<Room, "grid_cols" | "grid_rows">> | undefined) => ({
  cols: Math.max(1, room?.grid_cols ?? 6),
  rows: Math.max(1, room?.grid_rows ?? 5),
});

/** C'è una parete sulla linea retta tra due tavoli della stessa riga o colonna? */
export function wallBetween(a: Pick<RTable, "x" | "y">, b: Pick<RTable, "x" | "y">, walls: string[]): boolean {
  if (a.y === b.y) {
    for (let x = Math.min(a.x, b.x) + 1; x <= Math.max(a.x, b.x); x++) if (walls.includes(`v:${x}:${a.y}`)) return true;
    for (let x = Math.min(a.x, b.x) + 1; x < Math.max(a.x, b.x); x++) if (walls.includes(obstacleKey(x, a.y))) return true;
  } else if (a.x === b.x) {
    for (let y = Math.min(a.y, b.y) + 1; y <= Math.max(a.y, b.y); y++) if (walls.includes(`h:${a.x}:${y}`)) return true;
    for (let y = Math.min(a.y, b.y) + 1; y < Math.max(a.y, b.y); y++) if (walls.includes(obstacleKey(a.x, y))) return true;
  }
  return false;
}

type JoinT = Pick<RTable, "id" | "x" | "y" | "room_id" | "no_join"> & { accoppiabile?: boolean };
/** Due tavoli si possono unire? No se uno esclude l'altro o se c'è una parete tra loro (stessa sala). */
export function canJoin(a: JoinT, b: JoinT, wallsByRoom: (roomId: string) => string[]): boolean {
  if (a.accoppiabile === false || b.accoppiabile === false) return false;
  if (a.no_join?.includes(b.id) || b.no_join?.includes(a.id)) return false;
  if (a.room_id === b.room_id && wallBetween(a, b, wallsByRoom(a.room_id))) return false;
  return true;
}
