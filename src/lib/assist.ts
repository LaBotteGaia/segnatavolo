import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Contesto "Modalità Assistenza": il Super Admin opera su un ristorante non suo. */
export type AssistTarget = { id: string; name: string };

const KEY = "segnatavolo_assist";
const EVENT = "segnatavolo-assist-change";

let cached: AssistTarget | null | undefined;

export function getAssist(): AssistTarget | null {
  if (cached !== undefined) return cached;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return (cached = null);
    const v = JSON.parse(raw) as AssistTarget;
    return (cached = v && typeof v.id === "string" && v.id ? v : null);
  } catch {
    return (cached = null);
  }
}

export function setAssist(target: AssistTarget | null) {
  cached = target;
  if (target) sessionStorage.setItem(KEY, JSON.stringify(target));
  else sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export const clearAssist = () => setAssist(null);
export const assistId = () => getAssist()?.id ?? null;

/** Applica il filtro per ristorante quando la Modalità Assistenza è attiva (le policy bypass mostrerebbero tutti i locali). */
export function scopeAssist<Q extends { eq: (col: string, val: string) => Q }>(query: Q): Q {
  const id = assistId();
  return id ? query.eq("restaurant_id", id) : query;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Stato reattivo della Modalità Assistenza. */
export function useAssist(): AssistTarget | null {
  return useSyncExternalStore(subscribe, getAssist, () => null);
}

/** true se l'utente collegato è un Super Admin della piattaforma. */
export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ["is-super-admin"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_super_admin");
      if (error) return false;
      return data === true;
    },
  });
}
