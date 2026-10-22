import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "./membership";

export const LIVE_QUERY_KEYS = ["reservations", "reservations-month", "online-requests", "customers", "customer-history", "search", "recycle-bin", "service-note", "members"];
export const OFFLINE_TTL = 60_000;
const changes = new Map<string, number>();
const listeners = new Set<() => void>();
function notifyRow(id: string) {
  const timestamp = Date.now();
  changes.set(id, timestamp);
  listeners.forEach((fn) => fn());
  setTimeout(() => { if (changes.get(id) === timestamp) { changes.delete(id); listeners.forEach((fn) => fn()); } }, 1800);
}
export function useLiveRow(id: string) {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => changes.get(id) ?? 0, () => 0);
}

/** One restaurant-scoped subscription; DELETE cannot be filtered by restaurant_id because its old payload only has the primary key. */
export function LiveSync() {
  const qc = useQueryClient();
  const { data: me } = useMembership();
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user.id ?? null);
      if (event === "SIGNED_OUT") {
        try { for (const key of Object.keys(sessionStorage)) if (key.startsWith("segnatavolo-cache-")) sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
        changes.clear(); qc.clear();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  useEffect(() => {
    if (!userId || !me || me.user_id !== userId || me.status !== "active") return;
    const storageKey = `segnatavolo-cache-${userId}-${me.restaurant_id}`;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (saved && Date.now() - saved.at <= OFFLINE_TTL) {
        for (const row of saved.rows) if (Date.now() - row.at <= OFFLINE_TTL && row.key.at(-1) === me.restaurant_id && Array.isArray(row.data) && row.data.every((r: { restaurant_id?: string }) => r.restaurant_id === me.restaurant_id) && !qc.getQueryData(row.key)) qc.setQueryData(row.key, row.data, { updatedAt: row.at });
      }
    } catch { /* Browser storage is optional. */ }
    const persist = () => {
      const rows = qc.getQueryCache().getAll().filter((q) => ["reservations", "rooms", "tables", "customers"].includes(String(q.queryKey[0])) && q.queryKey.at(-1) === me.restaurant_id && q.state.data !== undefined).map((q) => ({ key: q.queryKey, data: q.state.data, at: q.state.dataUpdatedAt }));
      try { sessionStorage.setItem(storageKey, JSON.stringify({ at: Date.now(), rows })); } catch { /* Quota/private browsing. */ }
    };
    const unsubscribe = qc.getQueryCache().subscribe((event) => { if (event.type === "updated" && event.action.type === "success") persist(); });
    const refresh = () => [...LIVE_QUERY_KEYS, "rooms", "tables"].forEach((key) => { void qc.invalidateQueries({ queryKey: [key] }); });
    const change = (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
      const row = payload.eventType === "DELETE" ? payload.old : payload.new;
      if (payload.eventType !== "DELETE" && row["restaurant_id"] !== me.restaurant_id) return;
      if (typeof row["id"] === "string" && payload.eventType !== "DELETE" && !row["deleted_at"]) notifyRow(row["id"]);
      refresh();
    };
    const channel = supabase.channel(`service-${me.restaurant_id}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, change)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, change)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_notes" }, change)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, change)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, change)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_members" }, change)
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    const visible = () => { if (document.visibilityState === "visible" && navigator.onLine) refresh(); };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => { unsubscribe(); void supabase.removeChannel(channel); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [qc, userId, me?.restaurant_id, me?.status]);
  return null;
}