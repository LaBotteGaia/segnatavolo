import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConnState = "online" | "degraded" | "offline";

export type ConnStatus = {
  state: ConnState;
  /** Tempo di risposta dell'ultimo ping in ms, null se mai riuscito. */
  pingMs: number | null;
  /** Motivo dell'errore, se presente. */
  error: string | null;
  checking: boolean;
  testNow: () => void;
};

const SLOW_MS = 4500;
const INTERVAL_MS = 60_000;

/** Ping leggero al database: conta 0 righe su reservations. */
async function ping(): Promise<{ ms: number }> {
  const t0 = performance.now();
  const { error } = await supabase.from("reservations").select("id", { count: "exact", head: true }).limit(1);
  const ms = Math.round(performance.now() - t0);
  if (error) throw new Error(error.message);
  return { ms };
}

export function useConnectionStatus(): ConnStatus {
  const [state, setState] = useState<ConnState>(() => (navigator.onLine ? "online" : "offline"));
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    if (!navigator.onLine) { setState("offline"); setError("Nessuna connessione a internet"); return; }
    busy.current = true;
    setChecking(true);
    try {
      const { ms } = await ping();
      setPingMs(ms);
      setError(null);
      setState(ms > SLOW_MS ? "degraded" : "online");
    } catch (e) {
      setState("offline");
      setError(e instanceof Error ? e.message : "Errore di connessione");
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
    const onOnline = () => void check();
    const onOffline = () => { setState("offline"); setError("Nessuna connessione a internet"); };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void check(), INTERVAL_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [check]);

  return { state, pingMs, error, checking, testNow: () => void check() };
}
