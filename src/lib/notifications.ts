import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { shiftName } from "@/lib/data";

const KEY = "notify-new-reservations";
const EVT = "notify-pref-change";

export function useNotifyPref(): [boolean, (v: boolean) => Promise<void>] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(localStorage.getItem(KEY) === "1");
    read();
    window.addEventListener(EVT, read);
    return () => window.removeEventListener(EVT, read);
  }, []);
  const set = async (v: boolean) => {
    if (v && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* ignore */ }
    }
    if (v && "Notification" in window && Notification.permission === "denied")
      toast("Notifiche di sistema bloccate dal browser: riceverai solo avviso sonoro e banner.");
    localStorage.setItem(KEY, v ? "1" : "0");
    window.dispatchEvent(new Event(EVT));
  };
  return [on, set];
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.16);
    });
  } catch { /* ignore */ }
}

/** Ascolta le nuove prenotazioni del ristorante e avvisa (se attivato su questo dispositivo), escluso chi le inserisce. */
export function useNewReservationNotifications() {
  const [on] = useNotifyPref();
  useEffect(() => {
    if (!on) return;
    let uid: string | undefined;
    supabase.auth.getUser().then(({ data }) => { uid = data.user?.id; });
    const ch = supabase
      .channel("notify-new-res")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservations" }, (p) => {
        const r = p.new as { created_by?: string | null; name: string; people: number; date: string; time: string; shift: string };
        if (!uid || r.created_by === uid) return;
        const [y, m, d] = r.date.split("-");
        const text = `${r.name} · ${r.people} pers. · ${d}/${m}/${y} ${shiftName(r.shift)} ${r.time}`;
        beep();
        toast.info("🔔 Nuova prenotazione", { description: text, duration: 8000 });
        if ("Notification" in window && Notification.permission === "granted") {
          try { new Notification("Nuova prenotazione", { body: text, icon: "/icon-192.png" }); } catch { /* ignore */ }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [on]);
}
