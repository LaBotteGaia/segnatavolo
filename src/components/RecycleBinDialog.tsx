import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tableLabel, useRooms, useTables, type Reservation } from "@/lib/data";
import { useServiceClock } from "@/lib/extras";
import { refreshService, restoreReservation, useRecycleBin } from "@/lib/recycle-bin";

export function RecycleBinDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient(); const now = useServiceClock();
  const { data: rows = [], isPending, isError } = useRecycleBin(now, open);
  const { data: rooms } = useRooms(); const { data: tables } = useTables();
  const [conflict, setConflict] = useState<Reservation | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const restore = async (r: Reservation, withoutTables = false) => {
    if (busy) return; setBusy(r.id);
    try {
      const ok = await restoreReservation(r.id, withoutTables);
      if (!ok) { setConflict(r); return; }
      setConflict(null); await refreshService(qc); toast.success(withoutTables ? "Prenotazione ripristinata: tavolo da assegnare" : "Prenotazione ripristinata");
    } catch { toast.error("Ripristino non riuscito"); } finally { setBusy(null); }
  };
  return <Dialog open={open} onOpenChange={(v) => { if (!v) setConflict(null); onOpenChange(v); }}><DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto bg-paper">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Trash2 /> Cestino del giorno</DialogTitle></DialogHeader>
    {conflict && <div role="alert" className="space-y-2 rounded-md border border-warning bg-warning/10 p-3"><p className="text-sm font-semibold">Il tavolo originario è ora occupato. Ripristinare senza tavolo assegnato?</p><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!!busy} onClick={() => restore(conflict, true)}>Ripristina senza tavolo</Button><Button variant="outline" size="sm" onClick={() => setConflict(null)}>Annulla</Button></div></div>}
    {isError ? <p className="text-destructive">Cestino non disponibile. Riprova con la connessione attiva.</p> : isPending ? <p>Caricamento…</p> : !rows.length ? <p className="text-sm text-muted-foreground">Nessuna prenotazione eliminata oggi</p> : <ul className="divide-y divide-border">{rows.map((r) => <li key={r.id} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><div className="break-words font-semibold">{r.name || "Passante"}</div><div className="text-xs text-muted-foreground">Eliminata alle {r.deleted_at ? new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(r.deleted_at)) : "—"} · {r.people} coperti · {r.date.split("-").reverse().join("/")} {r.time}</div><div className="break-words text-xs">{tableLabel(r.table_ids, tables, rooms) || "Senza tavolo"}</div></div><Button size="sm" variant="outline" disabled={!!busy} onClick={() => restore(r)}><RotateCcw /> Ripristina</Button></li>)}</ul>}
  </DialogContent></Dialog>;
}