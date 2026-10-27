import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_SHIFTS, normalizeSettings, shiftName, totalCapacities, useRooms, useTables, type RestaurantSettings, type Shift } from "@/lib/data";
import { configurationError } from "@/lib/assignment-rules";

const ALL_TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const WEEKDAYS: [string, string][] = [["1", "Lunedì"], ["2", "Martedì"], ["3", "Mercoledì"], ["4", "Giovedì"], ["5", "Venerdì"], ["6", "Sabato"], ["0", "Domenica"]];

/** Orari, turni, rotazione, riserva, privacy e chiusure del ristorante (solo Master: RLS blocca gli altri). */
export function ServiceSettingsForm({ id, settings, walkinBuffer = 5 }: { id: string; settings: unknown; walkinBuffer?: number }) {
  const qc = useQueryClient();
  const [riassetto, setRiassetto] = useState(walkinBuffer);
  useEffect(() => { setRiassetto(walkinBuffer); }, [walkinBuffer]);
  const [st, setSt] = useState<RestaurantSettings>(() => normalizeSettings(settings));
  useEffect(() => { setSt(normalizeSettings(settings)); }, [settings]);
  const setShift = (s: Shift, patch: Partial<RestaurantSettings["shifts"][Shift]>) =>
    setSt((o) => ({ ...o, shifts: { ...o.shifts, [s]: { ...o.shifts[s], ...patch } } }));
  const toggleWeekly = (day: string, s: Shift) =>
    setSt((o) => {
      const cur = o.weekly[day] ?? [];
      return { ...o, weekly: { ...o.weekly, [day]: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] } };
    });
  const active = ALL_SHIFTS.filter((s) => st.shifts[s].enabled);
  const { data: rooms = [] } = useRooms();
  const { data: tables = [] } = useTables();
  const cap = totalCapacities(rooms, tables);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const s of active) if (st.shifts[s].from >= st.shifts[s].to) { toast.error(`${shiftName(s)}: l'orario di fine deve essere dopo l'inizio`); return; }
    if (st.holidays.some((h) => !h.from || !h.to || h.from > h.to)) { toast.error("Controlla le date delle ferie"); return; }
    const preserved = settings && typeof settings === "object" ? settings : {};
    const { data: saved, error } = await supabase.from("restaurants").update({ settings: { ...preserved, ...st }, tempo_riassetto_minuti: Math.min(60, Math.max(0, Math.round(riassetto))) }).eq("id", id).select("id");
    if (error || !saved?.length) { toast.error(configurationError(error ?? { code: "42501" })); return; }
    toast.success("Orari e turni salvati");
    qc.invalidateQueries({ queryKey: ["membership"] });
  };
  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-md border p-3"><div className="font-display text-2xl">{cap.inside}</div><div className="text-xs text-muted-foreground">Capienza interna</div></div>
        <div className="rounded-md border p-3"><div className="font-display text-2xl">{cap.outside}</div><div className="text-xs text-muted-foreground">Capienza esterna</div></div>
      </div>
      <p className="text-xs text-muted-foreground">Capienza, chiusura delle sale per turno e regole dei doppi turni si impostano nella scheda "Spazi &amp; Tavoli".</p>

      <section className="space-y-2">
        <h3 className="font-display text-lg">Turni e orari</h3>
        {ALL_SHIFTS.map((s) => (
          <div key={s} className="rounded-md border p-3">
            <label className="flex items-center justify-between font-semibold">
              {shiftName(s)}
              <Switch checked={st.shifts[s].enabled} onCheckedChange={(v) => setShift(s, { enabled: v })} aria-label={`Attiva ${shiftName(s)}`} />
            </label>
            {st.shifts[s].enabled && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["from", "to"] as const).map((k) => (
                  <div key={k}>
                    <div className="text-xs text-muted-foreground">{k === "from" ? "Inizio servizio" : "Fine servizio"}</div>
                    <Select value={st.shifts[s][k]} onValueChange={(v) => setShift(s, { [k]: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ALL_TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-lg">Rotazione tavoli</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Durata standard seduta
            <select className="mt-1 w-full rounded-md border bg-paper px-2 py-2" value={st.duration} onChange={(e) => setSt((o) => ({ ...o, duration: Number(e.target.value) }))}>
              {Array.from({ length: 16 }, (_, i) => (i + 2) * 15).map((m) => <option key={m} value={m}>{Math.floor(m / 60)}h {String(m % 60).padStart(2, "0")}m</option>)}
            </select>
          </label>
          <label className="text-sm">Cuscinetto di riassetto tra tavoli
            <select className="mt-1 w-full rounded-md border bg-paper px-2 py-2" value={st.buffer} onChange={(e) => setSt((o) => ({ ...o, buffer: Number(e.target.value) }))}>
              {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-lg">Accomoda al Volo</h3>
        <label className="flex flex-wrap items-center gap-2 text-sm">Tempo di riassetto e sparecchio tavolo (minuti)
          <NumberInput min={0} max={60} className="w-24" value={riassetto} onCommit={(n) => setRiassetto(Math.min(60, Math.max(0, n)))} aria-label="Tempo di riassetto e sparecchio tavolo (minuti)" />
        </label>
        <p className="text-xs text-muted-foreground">Minuti di cuscinetto sottratti all'orario della prenotazione successiva per calcolare la permanenza massima consentita per le sistemazioni al volo (walk-in).</p>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-lg">Coperti di Riserva (Margine di Sala)</h3>
        <label className="flex items-center gap-2 text-sm">
          <NumberInput min={0} max={200} className="w-24" value={st.reserve} onCommit={(reserve) => setSt((o) => ({ ...o, reserve }))} /> posti
        </label>
        <p className="text-xs text-muted-foreground">Posti sottratti dal totale per mantenere una riserva di emergenza / passanti prima che il turno sia considerato completo.</p>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-lg">Riorganizzazione Intelligente</h3>
        <label className="flex items-center justify-between gap-2 text-sm">
          Abilita Riorganizzazione Intelligente della Sala
          <Switch checked={st.reorganize} onCheckedChange={(v) => setSt((o) => ({ ...o, reorganize: v }))} aria-label="Abilita Riorganizzazione Intelligente della Sala" />
        </label>
        <p className="text-xs text-muted-foreground">Permette di ottimizzare automaticamente i coperti di sala privilegiando le sedute comode e riempiendo le sale secondo l'ordine di priorità stabilito.</p>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-lg">Privacy</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={st.privacy} onChange={(e) => setSt((o) => ({ ...o, privacy: e.target.checked }))} /> Modalità Privacy al banco (Maschera numeri telefonici)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={st.printPhones} onChange={(e) => setSt((o) => ({ ...o, printPhones: e.target.checked }))} /> Mostra numeri completi sul Foglio di Sala stampato</label>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-lg">Chiusure settimanali</h3>
        <p className="text-xs text-muted-foreground">Tocca i turni in cui il ristorante è chiuso.</p>
        {WEEKDAYS.map(([d, label]) => {
          const cur = st.weekly[d] ?? [];
          const all = active.length > 0 && active.every((s) => cur.includes(s));
          return (
            <div key={d} className="flex flex-wrap items-center gap-1.5">
              <span className="w-24 text-sm font-semibold">{label}</span>
              <button type="button" onClick={() => setSt((o) => ({ ...o, weekly: { ...o.weekly, [d]: all ? [] : [...active] } }))}
                className={`rounded-full border px-2.5 py-1 text-xs ${all ? "border-destructive bg-destructive text-destructive-foreground" : ""}`}>Tutto il giorno</button>
              {active.map((s) => (
                <button key={s} type="button" onClick={() => toggleWeekly(d, s)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${cur.includes(s) ? "border-destructive bg-destructive/15 text-destructive" : ""}`}>{shiftName(s)}</button>
              ))}
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-lg">Ferie e chiusure straordinarie</h3>
        {st.holidays.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs">dal</span>
            <Input type="date" value={h.from} onChange={(e) => setSt((o) => ({ ...o, holidays: o.holidays.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) }))} />
            <span className="text-xs">al</span>
            <Input type="date" value={h.to} onChange={(e) => setSt((o) => ({ ...o, holidays: o.holidays.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) }))} />
            <Button type="button" size="icon" variant="ghost" aria-label="Rimuovi" onClick={() => setSt((o) => ({ ...o, holidays: o.holidays.filter((_, j) => j !== i) }))}><Trash2 /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setSt((o) => ({ ...o, holidays: [...o.holidays, { from: "", to: "" }] }))}><Plus /> Aggiungi periodo</Button>
      </section>

      <Button type="submit" className="w-full">Salva orari e turni</Button>
    </form>
  );
}
