import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { extrasText, shiftName, tableLabel, useRooms, useTables, type Reservation, type Shift } from "@/lib/data";
import { useSettings } from "@/lib/membership";
import { useActiveRestaurantId } from "@/lib/tenant";
import { reorganizeService, type ReorgResult } from "@/lib/reorganize";
import { wallsOf } from "@/lib/data";
import { useActiveCustomRules } from '@/lib/data';

/** Pulsante a fondo colonna: calcola la disposizione ottimale del turno e la applica dopo conferma. */
export function ReorganizeButton({ date, shift, rows }: { date: string; shift: Shift; rows: Reservation[] }) {
  const { data: rooms = [] } = useRooms();
  const { data: tables = [] } = useTables();
  const settings = useSettings();
  const customRules = useActiveCustomRules();
  const restaurantId = useActiveRestaurantId();
  const qc = useQueryClient();
  const [result, setResult] = useState<ReorgResult | null>(null);
  const [busy, setBusy] = useState(false);

  const labelOf = (ids: string[]) => (ids.length ? tableLabel(ids, tables, rooms) : "nessun tavolo");

  const compute = () => {
    if (!rows.length) { toast("Nessuna prenotazione da riorganizzare in questo turno"); return; }
    setResult(
      reorganizeService({
        date, shift, reservations: rows, tables, rooms,
        rules: settings.assignmentRules, customRules,
        cfg: { duration: settings.duration, buffer: settings.buffer },
        wallsFor: (rid) => wallsOf(rooms.find((r) => r.id === rid)),
      }),
    );
  };

  const apply = async () => {
    if (!result) return;
    setBusy(true);
    let failed = false;
    for (const [id, a] of result.assignments) {
      const { error } = await supabase
        .from("reservations")
        .update({ table_ids: a.ids, extra_sponde: a.extras.extra_sponde, extra_barelle: 0, ha_posti_scomodi: a.ha_posti_scomodi })
        .eq("id", id)
        .eq("restaurant_id", restaurantId ?? "");
      if (error) failed = true;
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["reservations", date] });
    if (failed) { toast.error("Alcune assegnazioni non sono state salvate"); return; }
    toast.success(`Sala riorganizzata: ${result.moves.length} ${result.moves.length === 1 ? "prenotazione spostata" : "prenotazioni spostate"}`);
    setResult(null);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="mt-2 w-full border-dashed" disabled={!rows.length} onClick={compute}>
        <Sparkles /> 🪄 Riorganizza Sala Automaticamente
      </Button>
      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto bg-paper">
          <DialogHeader><DialogTitle>🪄 Riorganizzazione {shiftName(shift)}</DialogTitle></DialogHeader>
          {result && (
            <div className="space-y-3 text-sm">
              {result.moves.length === 0 && <p className="font-semibold text-free">✓ La sala è già organizzata in modo ottimale: nessuno spostamento necessario.</p>}
              {result.moves.length > 0 && (
                <ul className="space-y-1.5">
                  {result.moves.map((m) => (
                    <li key={m.id} className="rounded-md border bg-card px-3 py-2">
                      <span className="font-semibold">{m.name || "—"} ({m.people}p)</span>: {labelOf(m.from)} ➔ <span className="font-semibold text-primary">{labelOf(m.to)}{extrasText(m.extras)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                {result.unchanged} già ben piazzate · {result.locked} bloccate col lucchetto
              </p>
              {result.unplaced.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
                  <p className="font-semibold text-destructive">⚠️ Da allocare manualmente / Conflitto orario da verificare ({result.unplaced.length})</p>
                  <ul className="mt-1 list-disc pl-4">{result.unplaced.map((r) => <li key={r.id}>{r.name || "—"} ({r.people}p, {r.time || "--:--"}) — resta su {labelOf(r.table_ids)}</li>)}</ul>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setResult(null)}>Annulla</Button>
                {result.moves.length > 0 && <Button disabled={busy} onClick={apply}>{busy ? "Applicazione…" : "Applica modifiche in Agenda"}</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
