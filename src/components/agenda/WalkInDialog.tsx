import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { List, Map, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compareTables, isShiftClosed, shiftName, useReservations, useRooms, useTables } from "@/lib/data";
import { useSettings, useWalkinBuffer } from "@/lib/membership";
import { useServiceClock } from "@/lib/extras";
import { isRoomClosedFor, tableState } from "@/lib/rotation";
import { walkinClock, walkinValues, WALKIN_DEFAULT_PEOPLE } from "@/lib/service-actions";
import { refreshService } from "@/lib/recycle-bin";
import { supabase } from "@/integrations/supabase/client";
import { FloorPlan } from './FloorPlan';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { freeWindow, isScomodo, limitedStay, nextBookingOn, toMin } from "@/lib/live-floor";
import { cn } from "@/lib/utils";

export function WalkInDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: (date: string, shift: "colazione" | "pranzo" | "sera") => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-[calc(100vw-1rem)] grid-cols-[minmax(0,1fr)] overflow-x-hidden sm:max-w-4xl overflow-y-auto bg-paper p-3 sm:p-6"><WalkInForm onClose={() => onOpenChange(false)} onSaved={onSaved} /></DialogContent></Dialog>;
}
function WalkInForm({ onClose, onSaved }: { onClose: () => void; onSaved: (date: string, shift: "colazione" | "pranzo" | "sera") => void }) {
  const settings = useSettings(); const now = useServiceClock(); const qc = useQueryClient();
  const clock = walkinClock(now, settings);
  const walkinBuffer = useWalkinBuffer(); const walkCfg = { ...settings, buffer: walkinBuffer };
  const [confirmLim, setConfirmLim] = useState<{ next: string; until: string } | null>(null);
  const { data: rows = [], isSuccess: rowsReady } = useReservations(clock.date);
  const { data: rooms = [], isSuccess: roomsReady } = useRooms();
  const { data: tables = [], isSuccess: tablesReady } = useTables();
  const [people, setPeople] = useState(WALKIN_DEFAULT_PEOPLE);
  const [name, setName] = useState("Passante"); const [table, setTable] = useState(""); const [busy, setBusy] = useState(false);
  const closed = !settings.shifts[clock.shift].enabled || isShiftClosed(clock.date, clock.shift, settings);
  const ready = rowsReady && roomsReady && tablesReady;
  const shiftRows = rows.filter((r) => r.shift === clock.shift);
  const nowMin = toMin(clock.time);
  const nowState = (id: string) => tableState(id, { id: "walkin", time: clock.time, duration_min: 15, buffer_min: 0 }, shiftRows, settings);
  const maxOf = (t: (typeof tables)[number]) => Math.max(t.coperti_max ?? t.seats, t.seats);
  const free = closed || !ready ? [] : tables.filter((t) => maxOf(t) >= people && !isRoomClosedFor(rooms.find((r) => r.id === t.room_id), clock.date, clock.shift) && nowState(t.id).kind !== "busy" && (limitedStay(toMin(nextBookingOn([t.id], shiftRows, nowMin)?.time ?? ""), nowMin, walkCfg)?.allowed ?? true)).sort(compareTables(rooms));
  const win = (id: string) => freeWindow(id, shiftRows, nowMin, walkinBuffer);
  const [askScomodo, setAskScomodo] = useState<string | null>(null);
  const pick = (id: string) => {
    if (id === table) return setTable("");
    const t = free.find((x) => x.id === id);
    if (!t) return void toast.warning("Tavolo non disponibile per questi coperti");
    if (isScomodo(t, people)) return setAskScomodo(id);
    setTable(id);
  };
  const selected = free.some((t) => t.id === table);
  const [roomId, setRoomId] = useState('');
  const [view, setView] = useState<'map'|'list'>('map');
  useEffect(() => { if (!roomId && rooms.length) setRoomId(rooms.find(r => !isRoomClosedFor(r,clock.date,clock.shift))?.id ?? rooms[0]?.id ?? ''); }, [rooms, roomId, clock.date, clock.shift]);
  const room = rooms.find(r => r.id === roomId);
  const save = async (e?: React.FormEvent, confirmed = false) => {
    e?.preventDefault(); if (!selected || busy) return;
    setBusy(true);
    try {
      const next = nextBookingOn([table], shiftRows, nowMin);
      const lim = next ? limitedStay(toMin(next.time), nowMin, walkCfg) : null;
      if (lim && next && !confirmed) { setConfirmLim({ next: next.time, until: lim.until }); return; }
      if (lim) {
        setConfirmLim(null);
        const { data, error } = await supabase.rpc("seat_walkin_limited", walkinValues(name, people, table));
        if (error) { toast.error(error.message); await refreshService(qc); return; }
        await refreshService(qc); toast.success(`Tavolo assegnato con uscita prevista entro le ${data ?? lim.until}`); onSaved(clock.date, clock.shift); onClose(); return;
      }
      const { error } = await supabase.rpc("create_service_walkin", walkinValues(name, people, table));
      if (error) { toast.error(error.message); await refreshService(qc); return; }
      await refreshService(qc); toast.success("Passante accomodato e segnato come arrivato"); onSaved(clock.date, clock.shift); onClose();
    } finally { setBusy(false); }
  };
  return <>
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap /> Accomoda al volo</DialogTitle></DialogHeader>
    <div className="text-sm font-semibold text-primary">{shiftName(clock.shift)} · {clock.time} · {clock.date.split("-").reverse().join("/")}</div>
    <form onSubmit={save} className="space-y-4">
      <fieldset><legend className="mb-2 text-sm font-semibold">Coperti / Persone</legend><div className="grid grid-cols-5 gap-2">{[1,2,3,4,5,6,7,8].map((n) => <Button key={n} type="button" className="h-12 text-lg" variant={people === n ? "default" : "outline"} aria-pressed={people === n} onClick={() => setPeople(n)}>{n}</Button>)}<Button type="button" variant="outline" className="h-12" aria-label="Aggiungi una persona" onClick={() => setPeople((p) => p + 1)}><Plus /></Button></div>{people > 8 && <NumberInput aria-label="Numero coperti" min={1} defaultValue={WALKIN_DEFAULT_PEOPLE} value={people} onCommit={setPeople} className="mt-2" />}</fieldset>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Tavolo</legend>
        <div className="flex flex-wrap justify-between gap-2"><div role="tablist" aria-label="Sale" className="flex flex-wrap gap-1">{rooms.map(r=><Button type="button" key={r.id} role="tab" aria-selected={roomId===r.id} variant={roomId===r.id?'secondary':'outline'} onClick={()=>setRoomId(r.id)}>{r.name}</Button>)}</div><div className="flex gap-1"><Button type="button" aria-pressed={view==='map'} variant={view==='map'?'secondary':'ghost'} onClick={()=>setView('map')}><Map/>Mappa</Button><Button type="button" aria-pressed={view==='list'} variant={view==='list'?'secondary':'ghost'} onClick={()=>setView('list')}><List/>Lista</Button></div></div>
        {view==='map' && room ? <FloorPlan room={room} tables={tables.filter(t=>t.room_id===roomId)} selected={selected?[table]:[]} suggested={[]} people={people} extended={false} closed={closed||!ready||isRoomClosedFor(room,clock.date,clock.shift)} stateOf={id=>tableState(id,{id:'walkin',time:clock.time,duration_min:90,buffer_min:15},rows.filter(r=>r.shift===clock.shift),settings)} pillOf={id=>free.some(t=>t.id===id)?win(id).short:null} onToggle={pick}/> : <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto min-[420px]:grid-cols-2">{free.filter(t=>t.room_id===roomId).map((t) => { const w = win(t.id), sc = isScomodo(t, people); return <Button key={t.id} type="button" variant={selected && table === t.id ? "default" : "outline"} className={cn("h-auto min-h-16 flex-col items-start gap-1 whitespace-normal text-left", sc && !(selected && table === t.id) && "border-2 border-warning")} aria-pressed={selected && table === t.id} onClick={() => pick(t.id)}><span className="font-bold">Tavolo {t.name} · {t.coperti_comodi ?? t.seats} comodi / {maxOf(t)} max</span>{sc && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-foreground">⚠️ Posti Scomodi (Max {maxOf(t)}p)</span>}<span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", w.kind === "imminent" ? "bg-warning/20 text-foreground" : "bg-free/15 text-foreground")}>{w.label}</span></Button>; })}</div>}
        <p role="status" className="min-h-6 text-sm font-semibold">{selected?`Selezionato: Tavolo ${tables.find(t=>t.id===table)?.name} · ${win(table).label}`:!free.length?closed?'Servizio chiuso':!ready?'Caricamento tavoli…':'Nessun tavolo libero per questi coperti':'Nessun tavolo selezionato'}</p>
      </fieldset>
      <div><Label htmlFor="walkin-name">Nome / Riferimento (facoltativo)</Label><Input id="walkin-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <Button type="submit" className="h-12 w-full" disabled={!selected || busy}><Zap /> {busy ? "Salvataggio…" : `Accomoda ${people} ${people === 1 ? "persona" : "persone"}`}</Button>
    </form>
    <AlertDialog open={!!confirmLim} onOpenChange={(o) => { if (!o) setConfirmLim(null); }}>
      <AlertDialogContent>{confirmLim && <>
        <AlertDialogHeader><AlertDialogTitle>⚠️ Tavolo prenotato alle {confirmLim.next}.</AlertDialogTitle>
          <AlertDialogDescription>Considerando {walkinBuffer} minuti di riassetto, la permanenza massima è fino alle {confirmLim.until}.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Annulla / Scegli altro</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void save(undefined, true); }}>✅ Conferma con uscita entro le {confirmLim.until}</AlertDialogAction></AlertDialogFooter>
      </>}</AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={!!askScomodo} onOpenChange={(o) => { if (!o) setAskScomodo(null); }}>
      <AlertDialogContent>{(() => { const t = tables.find((x) => x.id === askScomodo); if (!t) return null; return <>
        <AlertDialogHeader><AlertDialogTitle>⚠️ Assegnazione con Posti Scomodi</AlertDialogTitle>
          <AlertDialogDescription>Il Tavolo {t.name} offre {t.coperti_comodi ?? t.seats} posti comodi (max {maxOf(t)}). Per {people} persone la seduta sarà stretta o a ridosso del passaggio. Vuoi procedere?</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Annulla / Scegli altro</AlertDialogCancel><AlertDialogAction onClick={() => { setTable(t.id); setAskScomodo(null); }}>✅ Sì, Accomoda Comunque</AlertDialogAction></AlertDialogFooter>
      </>; })()}</AlertDialogContent>
    </AlertDialog>
  </>;
}