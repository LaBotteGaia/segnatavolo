import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compareTables, isShiftClosed, shiftName, useReservations, useRooms, useTables } from "@/lib/data";
import { useSettings } from "@/lib/membership";
import { useServiceClock } from "@/lib/extras";
import { isRoomClosedFor, tableState } from "@/lib/rotation";
import { walkinClock, walkinValues, WALKIN_DEFAULT_PEOPLE } from "@/lib/service-actions";
import { refreshService } from "@/lib/recycle-bin";
import { supabase } from "@/integrations/supabase/client";

export function WalkInDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: (date: string, shift: "colazione" | "pranzo" | "sera") => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto bg-paper"><WalkInForm onClose={() => onOpenChange(false)} onSaved={onSaved} /></DialogContent></Dialog>;
}
function WalkInForm({ onClose, onSaved }: { onClose: () => void; onSaved: (date: string, shift: "colazione" | "pranzo" | "sera") => void }) {
  const settings = useSettings(); const now = useServiceClock(); const qc = useQueryClient();
  const clock = walkinClock(now, settings);
  const { data: rows = [], isSuccess: rowsReady } = useReservations(clock.date);
  const { data: rooms = [], isSuccess: roomsReady } = useRooms();
  const { data: tables = [], isSuccess: tablesReady } = useTables();
  const [people, setPeople] = useState(WALKIN_DEFAULT_PEOPLE);
  const [name, setName] = useState("Passante"); const [table, setTable] = useState(""); const [busy, setBusy] = useState(false);
  const closed = !settings.shifts[clock.shift].enabled || isShiftClosed(clock.date, clock.shift, settings);
  const ready = rowsReady && roomsReady && tablesReady;
  const free = closed || !ready ? [] : tables.filter((t) => t.seats >= people && !isRoomClosedFor(rooms.find((r) => r.id === t.room_id), clock.date, clock.shift) && tableState(t.id, { id: "walkin", time: clock.time, duration_min: 90, buffer_min: 15 }, rows.filter((r) => r.shift === clock.shift), settings).kind !== "busy").sort(compareTables(rooms));
  const selected = free.some((t) => t.id === table);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_service_walkin", walkinValues(name, people, table));
      if (error) { toast.error(error.message); await refreshService(qc); return; }
      await refreshService(qc); toast.success("Passante accomodato e segnato come arrivato"); onSaved(clock.date, clock.shift); onClose();
    } finally { setBusy(false); }
  };
  return <>
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap /> Accomoda al volo</DialogTitle></DialogHeader>
    <div className="text-sm font-semibold text-primary">{shiftName(clock.shift)} · {clock.time} · {clock.date.split("-").reverse().join("/")}</div>
    <form onSubmit={save} className="space-y-4">
      <fieldset><legend className="mb-2 text-sm font-semibold">Coperti / Persone</legend><div className="grid grid-cols-5 gap-2">{[1,2,3,4,5,6,7,8].map((n) => <Button key={n} type="button" className="h-12 text-lg" variant={people === n ? "default" : "outline"} aria-pressed={people === n} onClick={() => setPeople(n)}>{n}</Button>)}<Button type="button" variant="outline" className="h-12" aria-label="Aggiungi una persona" onClick={() => setPeople((p) => p + 1)}><Plus /></Button></div>{people > 8 && <Input aria-label="Numero coperti" type="number" min={1} value={people} onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))} className="mt-2" />}</fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Tavolo</legend><div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto">{free.map((t) => <Button key={t.id} type="button" variant={selected && table === t.id ? "default" : "outline"} className="h-auto min-h-14 flex-col gap-0.5 whitespace-normal" aria-pressed={selected && table === t.id} onClick={() => setTable(t.id)}><span className="font-bold">Tavolo {t.name} · {t.seats} posti</span><span className="text-xs">{rooms.find((r) => r.id === t.room_id)?.name}</span></Button>)}</div>{!free.length && <p role="status" className="text-sm text-muted-foreground">{closed ? "Servizio chiuso" : !ready ? "Caricamento tavoli…" : "Nessun tavolo libero per questi coperti"}</p>}</fieldset>
      <div><Label htmlFor="walkin-name">Nome / Riferimento (facoltativo)</Label><Input id="walkin-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <Button type="submit" className="h-12 w-full" disabled={!selected || busy}><Zap /> {busy ? "Salvataggio…" : `Accomoda ${people} ${people === 1 ? "persona" : "persone"}`}</Button>
    </form>
  </>;
}