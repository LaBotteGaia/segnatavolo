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
