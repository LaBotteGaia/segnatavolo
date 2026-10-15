import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Room = Tables<"rooms">;
export type RTable = Tables<"restaurant_tables">;
export type Customer = Tables<"customers">;
export type Reservation = Tables<"reservations">;
export type Shift = "pranzo" | "sera";

export const roomsQuery = () => ({
  queryKey: ["rooms"],
  queryFn: async () => {
    const { data, error } = await supabase.from("rooms").select("*").order("sort_order").order("created_at");
    if (error) throw error;
    return data;
  },
});

export const tablesQuery = () => ({
  queryKey: ["tables"],
  queryFn: async () => {
    const { data, error } = await supabase.from("restaurant_tables").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const customersQuery = () => ({
  queryKey: ["customers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const reservationsQuery = (date: string) => ({
  queryKey: ["reservations", date],
  queryFn: async () => {
    const { data, error } = await supabase.from("reservations").select("*").eq("date", date);
    if (error) throw error;
    return data;
  },
});

export function useRooms() {
  return useQuery(roomsQuery());
}
export function useTables() {
  return useQuery(tablesQuery());
}
export function useCustomers() {
  return useQuery(customersQuery());
}
export function useReservations(date: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("res-" + date)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        qc.invalidateQueries({ queryKey: ["reservations", date] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [date, qc]);
  return useQuery(reservationsQuery(date));
}

export function findCustomer(customers: Customer[] | undefined, name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return customers?.find((c) => c.name.trim().toLowerCase() === n);
}

/** Totals for a shift page header. */
export function shiftCounters(rows: Pick<Reservation, "people" | "outside" | "arrived">[]) {
  let total = 0, inside = 0, outside = 0, pending = 0;
  for (const r of rows) {
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
  for (const id of ids) {
    const t = tables.find((x) => x.id === id);
    if (!t) continue;
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
export const SHIFT_RANGES: Record<Shift, { from: string; to: string }> = {
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
export function timeSlots(shift: Shift): string[] {
  const out: string[] = [];
  for (let m = toMin(SHIFT_RANGES[shift].from); m <= toMin(SHIFT_RANGES[shift].to); m += 15)
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
}

export function shiftForTime(time: string): Shift | null {
  const m = toMin(time);
  for (const s of ["pranzo", "sera"] as Shift[])
    if (m >= toMin(SHIFT_RANGES[s].from) && m <= toMin(SHIFT_RANGES[s].to)) return s;
  return null;
}

export type ReservationErrors = Partial<Record<"name" | "people" | "date" | "time", string>>;

/** Blocking checks before saving a reservation. */
export function validateReservation(v: { name: string; people: string | number | null; date: string; time: string; shift: Shift }): ReservationErrors {
  const e: ReservationErrors = {};
  if (!v.name.trim()) e.name = "Inserisci il nome del cliente";
  const p = typeof v.people === "number" ? v.people : v.people === null || String(v.people).trim() === "" ? NaN : Number(v.people);
  if (!Number.isInteger(p) || p < 1) e.people = "Inserisci almeno 1 persona";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || isNaN(Date.parse(v.date))) e.date = "Seleziona una data valida";
  if (shiftForTime(v.time) !== v.shift) {
    const r = SHIFT_RANGES[v.shift];
    e.time = `Seleziona un orario valido tra le ${r.from} e le ${r.to}`;
  }
  return e;
}

export const shiftName = (s: Shift) => (s === "pranzo" ? "Pranzo" : "Cena");
const shiftOf = (s: Shift) => (s === "pranzo" ? "del Pranzo" : "della Cena");
const shiftArticle = (s: Shift) => (s === "pranzo" ? "il pranzo" : "la cena");

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
export function commitTimeCheck(typed: string, shift: Shift | string): TimeCommit {
  const sh: Shift = shift === "pranzo" ? "pranzo" : "sera";
  const t = normalizeTime(typed);
  const w = SHIFT_RANGES[sh];
  if (!t) return { kind: "revert", error: `Inserisci un orario: per ${shiftArticle(sh)} scegli un orario tra le ${w.from} e le ${w.to}` };
  const s = shiftForTime(t);
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
