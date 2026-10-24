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
import { useSettings } from "@/lib/membership";
import { useServiceClock } from "@/lib/extras";
import { isRoomClosedFor, tableState } from "@/lib/rotation";
import { walkinClock, walkinValues, WALKIN_DEFAULT_PEOPLE } from "@/lib/service-actions";
import { refreshService } from "@/lib/recycle-bin";
import { supabase } from "@/integrations/supabase/client";
import { FloorPlan } from './FloorPlan';

export function WalkInDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: (date: string, shift: "colazione" | "pranzo" | "sera") => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-[calc(100vw-1rem)] grid-cols-[minmax(0,1fr)] overflow-x-hidden sm:max-w-4xl overflow-y-auto bg-paper p-3 sm:p-6"><WalkInForm onClose={() => onOpenChange(false)} onSaved={onSaved} /></DialogContent></Dialog>;
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
  const [roomId, setRoomId] = useState('');
  const [view, setView] = useState<'map'|'list'>('map');
  useEffect(() => { if (!roomId && rooms.length) setRoomId(rooms.find(r => !isRoomClosedFor(r,clock.date,clock.shift))?.id ?? rooms[0]?.id ?? ''); }, [rooms, roomId, clock.date, clock.shift]);
  const room = rooms.find(r => r.id === roomId);
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
      <fieldset><legend className="mb-2 text-sm font-semibold">Coperti / Persone</legend><div className="grid grid-cols-5 gap-2">{[1,2,3,4,5,6,7,8].map((n) => <Button key={n} type="button" className="h-12 text-lg" variant={people === n ? "default" : "outline"} aria-pressed={people === n} onClick={() => setPeople(n)}>{n}</Button>)}<Button type="button" variant="outline" className="h-12" aria-label="Aggiungi una persona" onClick={() => setPeople((p) => p + 1)}><Plus /></Button></div>{people > 8 && <NumberInput aria-label="Numero coperti" min={1} defaultValue={WALKIN_DEFAULT_PEOPLE} value={people} onCommit={setPeople} className="mt-2" />}</fieldset>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Tavolo</legend>
        <div className="flex flex-wrap justify-between gap-2"><div role="tablist" aria-label="Sale" className="flex flex-wrap gap-1">{rooms.map(r=><Button type="button" key={r.id} role="tab" aria-selected={roomId===r.id} variant={roomId===r.id?'secondary':'outline'} onClick={()=>setRoomId(r.id)}>{r.name}</Button>)}</div><div className="flex gap-1"><Button type="button" aria-pressed={view==='map'} variant={view==='map'?'secondary':'ghost'} onClick={()=>setView('map')}><Map/>Mappa</Button><Button type="button" aria-pressed={view==='list'} variant={view==='list'?'secondary':'ghost'} onClick={()=>setView('list')}><List/>Lista</Button></div></div>
        {view==='map' && room ? <FloorPlan room={room} tables={tables.filter(t=>t.room_id===roomId)} selected={selected?[table]:[]} suggested={[]} people={people} extended={false} closed={closed||!ready||isRoomClosedFor(room,clock.date,clock.shift)} stateOf={id=>tableState(id,{id:'walkin',time:clock.time,duration_min:90,buffer_min:15},rows.filter(r=>r.shift===clock.shift),settings)} onToggle={id=>{if(free.some(t=>t.id===id))setTable(id===table?'':id);else toast.warning('Tavolo non disponibile per questi coperti');}}/> : <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto">{free.filter(t=>t.room_id===roomId).map((t) => <Button key={t.id} type="button" variant={selected && table === t.id ? "default" : "outline"} className="h-auto min-h-14 flex-col gap-0.5 whitespace-normal" aria-pressed={selected && table === t.id} onClick={() => setTable(t.id)}><span className="font-bold">Tavolo {t.name} · {t.seats} posti</span></Button>)}</div>}
        <p role="status" className="min-h-6 text-sm font-semibold">{selected?`Selezionato: Tavolo ${tables.find(t=>t.id===table)?.name} · ${tables.find(t=>t.id===table)?.seats} coperti comodi`:!free.length?closed?'Servizio chiuso':!ready?'Caricamento tavoli…':'Nessun tavolo libero per questi coperti':'Nessun tavolo selezionato'}</p>
      </fieldset>
      <div><Label htmlFor="walkin-name">Nome / Riferimento (facoltativo)</Label><Input id="walkin-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <Button type="submit" className="h-12 w-full" disabled={!selected || busy}><Zap /> {busy ? "Salvataggio…" : `Accomoda ${people} ${people === 1 ? "persona" : "persone"}`}</Button>
    </form>
  </>;
}