import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, formatDistanceStrict, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

export const APP_NAME = "Segnatavolo";
export const APP_VERSION = "v0.1.0-alpha";

/* ---------- Fedeltà cliente ---------- */
export type VisitStats = { count: number; last: string | null };

/** Conta solo le prenotazioni passate (data < oggi). */
export function visitStats(dates: string[], today: string): VisitStats {
  const past = dates.filter((d) => d < today).sort();
  return { count: past.length, last: past.at(-1) ?? null };
}

export function lastVisitText(last: string, today: Date = new Date()): string {
  const d = parseISO(last);
  const days = differenceInCalendarDays(today, d);
  const rel = days <= 0 ? "oggi" : days === 1 ? "ieri" : formatDistanceStrict(d, today, { locale: it, addSuffix: true, roundingMethod: "floor" });
  return `${format(d, "d MMMM yyyy", { locale: it })} (${rel})`;
}

export function useVisitStats(customerId: string | null | undefined, phone: string | null | undefined, excludeId?: string) {
  const ph = (phone ?? "").trim();
  return useQuery({
    queryKey: ["visits", customerId ?? null, ph, excludeId ?? null],
    enabled: !!customerId || ph.length >= 5,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const ors = [customerId && `customer_id.eq.${customerId}`, ph.length >= 5 && `phone.eq.${ph}`].filter(Boolean).join(",");
      let q = supabase.from("reservations").select("id,date").or(ors).lt("date", today);
      if (excludeId) q = q.neq("id", excludeId);
      const { data } = await q;
      return visitStats((data ?? []).map((r) => r.date), today);
    },
  });
}

/* ---------- Campi tavolo ---------- */
export function validTableName(v: string) { return v.trim().length > 0; }
export function validSeats(v: string) { return /^\d+$/.test(v.trim()) && Number(v) > 0; }

/* ---------- Ricerca ---------- */
export function searchFilter(term: string) {
  const t = term.trim().replace(/[,()%*]/g, "");
  if (t.length < 3) return null;
  return `name.ilike.%${t}%,phone.ilike.%${t}%`;
}

/* ---------- Note di servizio ---------- */
export function useServiceNote(date: string, shift: string) {
  const qc = useQueryClient();
  const key = ["service-note", date, shift];
  useEffect(() => {
    const ch = supabase.channel(`note-${date}-${shift}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_notes" }, () => qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [date, shift]); // eslint-disable-line react-hooks/exhaustive-deps
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("service_notes").select("body").eq("date", date).eq("shift", shift).maybeSingle();
      return data?.body ?? "";
    },
  });
}

export async function saveServiceNote(restaurantId: string, date: string, shift: string, body: string) {
  return supabase.from("service_notes").upsert(
    { restaurant_id: restaurantId, date, shift, body, updated_at: new Date().toISOString() },
    { onConflict: "restaurant_id,date,shift" },
  );
}

/* ---------- CSV ---------- */
export function toCsv(rows: Record<string, unknown>[], cols: { key: string; label: string }[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : Array.isArray(v) ? v.join(" + ") : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map((c) => esc(c.label)).join(";"), ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(";"))].join("\r\n");
}
