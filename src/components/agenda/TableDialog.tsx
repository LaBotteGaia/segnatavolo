import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { List, Map, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { canJoin, extraSeats, NO_EXTRAS, shiftName, useRooms, useTables, wallsOf, type Reservation, type TableExtras } from "@/lib/data";
import { GRID_COLS, GRID_ROWS } from "./RoomGrid";
import { FloorPlan } from "./FloorPlan";
import { isRoomClosedFor, isRoomClosed, tableState } from "@/lib/rotation";
import { useMembership, useSettings } from "@/lib/membership";
import { TableCards } from './TableCards';
import { suggestTables } from '@/lib/allocation';
import { compareTableNames } from '@/lib/data';
import { useActiveCustomRules } from '@/lib/data';

export { GRID_COLS, GRID_ROWS };
/** Vista preferita del selettore tavoli, ricordata sul dispositivo. */
export const VIEW_KEY = "segnatavolo-table-view";

function Stepper({ label, value, onChange, disabled }: { label: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-1">
        <Button type="button" size="icon" variant="outline" className="size-8" disabled={disabled} aria-label={`Togli ${label}`} onClick={() => onChange(Math.max(0, value - 1))}><Minus /></Button>
        <span className="w-6 text-center font-bold tabular-nums">{value}</span>
        <Button type="button" size="icon" variant="outline" className="size-8" disabled={disabled} aria-label={label} onClick={() => onChange(Math.min(20, value + 1))}><Plus /></Button>
      </div>
    </div>
  );
}

export function TableDialog({
  open, onOpenChange, reservation, others, extras, onConfirm, date,
}: {
  date: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reservation: Pick<Reservation, "id" | "name" | "people" | "shift" | "table_ids" | "time"> & { duration_min?: number | null; buffer_min?: number | null; notes?: string; outside?: boolean };
  others: (Pick<Reservation, "id" | "name" | "table_ids" | "time"> & { duration_min?: number | null; buffer_min?: number | null })[];
  extras?: TableExtras;
  onConfirm: (ids: string[], extras: TableExtras) => void;
}) {
  const { data: rooms } = useRooms();
  const { data: tables } = useTables();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(reservation.table_ids);
  const [ex, setEx] = useState<TableExtras>(NO_EXTRAS);

  useEffect(() => {
    if (open) {
      setSelected(reservation.table_ids);
      setForce(false);
      setEx(extras ? { extra_sponde: extras.extra_sponde, extra_barelle: extras.extra_barelle, barella_seats: extras.barella_seats || 2 } : NO_EXTRAS);
      const first = tables?.find((t) => reservation.table_ids.includes(t.id));
      try { setView(localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "map"); } catch { setView("map"); }
      setRoomId(first?.room_id ?? rooms?.find(r => !isRoomClosedFor(r, date, reservation.shift))?.id ?? rooms?.[0]?.id ?? null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const settings = useSettings();
  const customRules = useActiveCustomRules();
  const isMaster = useMembership().data?.role === "master";
  const [force, setForce] = useState(false);
  const cfg = { duration: settings.duration, buffer: settings.buffer };
  const stateOf = useMemo(() => {
    const sameShift = others.filter((o) => o.id !== reservation.id);
    return (id: string) => tableState(id, reservation, sameShift, cfg);
  }, [others, reservation, cfg.duration, cfg.buffer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open && !roomId && rooms?.length) setRoomId(rooms.find(r => !isRoomClosedFor(r,date,reservation.shift))?.id ?? rooms[0]?.id ?? null); }, [open, roomId, rooms, date, reservation.shift]);

  const roomTables = tables?.filter((t) => t.room_id === roomId) ?? [];
  const nominal = tables?.filter((t) => selected.includes(t.id)).reduce((s, t) => s + (t.coperti_comodi ?? t.seats), 0) ?? 0;
  const physical = tables?.filter(t=>selected.includes(t.id)).reduce((n,t)=>n+(selected.length>1 || !t.posti_scomodi_solo_in_unione ? t.coperti_max : t.coperti_comodi),0) ?? 0;
  const effective = physical + (selected.length ? extraSeats(ex) : 0);
  const room = rooms?.find((r) => r.id === roomId);
  const over = selected.length > 0 && nominal < reservation.people;
  const ok = effective >= reservation.people;

  const selTables = tables?.filter((t) => selected.includes(t.id)) ?? [];
  const noExtras = selTables.length > 0 && (reservation.people<=8 || selTables.every((t) => !t.allow_extras));
  const extraLimit = selTables.filter(t=>t.allow_extras).length;
  const invalidExtras = extraSeats(ex)>0 && (reservation.people<=8 || ex.extra_sponde+ex.extra_barelle>extraLimit);
  const wallsFor = (rid: string) => wallsOf(rooms?.find((r) => r.id === rid));
  const suggestion = rooms && tables ? suggestTables({ people:reservation.people,date,shift:reservation.shift,time:reservation.time,tables,rooms,others,cfg,outside:reservation.outside,notes:reservation.notes,rules:settings.assignmentRules,customRules,wallsFor,me:reservation }) : null;
  const [view,setView] = useState<'cards'|'map'>('map');
  const pickView = (v: 'cards'|'map') => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage opzionale */ } };
  const invalidSelected = selTables.some(t=>stateOf(t.id).kind==='busy') || selTables.some((a,i)=>selTables.slice(i+1).some(b=>!canJoin(a,b,wallsFor)));
  const toggle = (id: string) => {
    if (selected.includes(id)) return setSelected((s) => s.filter((x) => x !== id));
    const t = tables?.find((x) => x.id === id);
    if (!t || stateOf(id).kind==='busy') return;
    if (t && selTables.some((o) => !canJoin(o, t, wallsFor))) {
      toast.warning("⚠️ Impossibile unire questi tavoli: presenza di ostacolo o vincolo strutturale");
      return;
    }
    setSelected((s) => [...s, id]);
  };
  useEffect(() => { if (noExtras && (ex.extra_sponde || ex.extra_barelle)) setEx((e) => ({ ...e, extra_sponde: 0, extra_barelle: 0 })); }, [noExtras]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] w-[calc(100%-1rem)] max-w-[calc(100vw-1rem)] grid-cols-[minmax(0,1fr)] overflow-x-hidden sm:max-w-4xl overflow-y-auto bg-paper p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Assegna tavoli
          </DialogTitle>
          <p className="font-hand text-lg text-muted-foreground">
            {reservation.name || "Prenotazione"} · {reservation.people} persone · {shiftName(reservation.shift)}
          </p>
        </DialogHeader>

        <div className={cn("rounded-md border px-3 py-2 text-sm font-semibold", ok ? "border-free text-free" : "border-busy text-busy")}>
          Posti effettivi: {effective} / {reservation.people} coperti
        </div>

        {(over || ex.extra_sponde > 0 || ex.extra_barelle > 0) && selected.length > 0 && (
          <div className={cn("space-y-2 rounded-md border-2 p-3", ok ? "border-free bg-free/10" : "border-warning bg-warning/15")}>
            <p className="text-sm font-bold">
              ⚠️ Capienza tavoli: {nominal} posti | Richiesti: {reservation.people} persone
              {nominal < reservation.people && ` (+${reservation.people - nominal} mancanti)`}
            </p>
            {noExtras && <p className="text-sm font-semibold text-busy">Questo tavolo non dispone di fessure/spazio per sponde o barelle. Scegli un altro tavolo o unisci un tavolo compatibile.</p>}
            <Stepper disabled={noExtras} label="Aggiungi Sponda (+1 posto)" value={ex.extra_sponde} onChange={(n) => setEx({ ...ex, extra_sponde: n })} />
            <Stepper disabled={noExtras} label={`Aggiungi Barella (+${ex.barella_seats} posti)`} value={ex.extra_barelle} onChange={(n) => setEx({ ...ex, extra_barelle: n })} />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Posti per barella:
              {[1, 2].map((n) => (
                <button key={n} type="button" onClick={() => setEx({ ...ex, barella_seats: n })}
                  className={cn("rounded-md border px-2 py-0.5 font-semibold", ex.barella_seats === n ? "bg-primary text-primary-foreground" : "bg-card")}>+{n}</button>
              ))}
            </div>
            {ok && <p className="text-sm font-semibold text-free">✓ Coperti raggiunti</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Sale" className="flex min-w-0 basis-full flex-wrap gap-1 sm:flex-1 sm:basis-auto">
            {rooms?.map(r => <Button key={r.id} role="tab" aria-selected={roomId===r.id} variant={roomId===r.id?'secondary':'outline'} className="h-auto min-h-9 whitespace-normal" onClick={() => { setRoomId(r.id); setForce(false); }}>{r.name}{isRoomClosedFor(r,date,reservation.shift)&&' · Chiusa'}{tables?.some(t=>t.room_id===r.id&&selected.includes(t.id))&&' ✓'}</Button>)}
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-md border bg-card sm:ml-auto" role="group" aria-label="Visualizzazione tavoli">
            <Button className="rounded-none" variant={view==='cards'?'secondary':'ghost'} aria-pressed={view==='cards'} onClick={()=>pickView('cards')}><List/>🔲 Elenco Bottoni</Button>
            <Button className="rounded-none border-l" variant={view==='map'?'secondary':'ghost'} aria-pressed={view==='map'} onClick={()=>pickView('map')}><Map/>🗺️ Mappa Sala</Button>
          </div>
        </div>
        {!rooms?.length && <p className="text-muted-foreground">Nessuna sala. Creala dal menù ☰ → Gestione Sale e Mappe.</p>}
        {room && <>
          {isRoomClosedFor(room, date, reservation.shift) && (
            <div className="rounded-md border border-muted-foreground/40 bg-muted p-3 text-sm">
              <p className="font-bold">{isRoomClosed(room, date) ? "❄️ Chiusa per stagione: in questa data i tavoli di questa sala non sono assegnabili." : `🚫 Chiusa per il turno ${shiftName(reservation.shift)}: i tavoli di questa sala non sono assegnabili.`}</p>
              {isMaster && <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Forza comunque l'assegnazione (solo Master)</label>}
            </div>
          )}
          {view==='cards' ? <TableCards tables={[...roomTables].sort((a,b)=>(a.ordine_riempimento ?? 10)-(b.ordine_riempimento ?? 10)||compareTableNames(a.name,b.name))} room={room} selected={selected} suggested={suggestion?.ids??[]} people={reservation.people} stateOf={stateOf} closed={isRoomClosedFor(room,date,reservation.shift)&&!force} onToggle={toggle}/> : <FloorPlan room={room} tables={roomTables} selected={selected} suggested={suggestion?.ids??[]} people={reservation.people} stateOf={stateOf} closed={isRoomClosedFor(room,date,reservation.shift)&&!force} extended={extraSeats(ex)>0} onToggle={toggle}/>}
        </>}
        <p role="status" aria-live="polite" className="min-h-10 rounded-md border bg-card px-3 py-2 text-sm font-semibold">{selected.length ? `Selezionato: ${selTables.map(t=>`Tavolo ${t.name}`).join(' + ')} · ${nominal} coperti comodi` : 'Nessun tavolo selezionato'}</p>

        {selected.length>1&&<div className="rounded-full border border-dashed border-primary bg-primary/5 px-4 py-2 text-center text-sm font-semibold text-primary">Tavoli {selTables.map(t=>t.name).join(' + ')} uniti</div>}
        {invalidSelected&&<p role="alert" className="text-sm text-destructive">Assegnazione non disponibile: rimuovi i tavoli occupati o incompatibili.</p>}
        {invalidExtras&&<p role="alert" className="text-sm text-destructive">Prolunghe solo oltre 8 persone, massimo una per tavolo abilitato.</p>}
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => { setSelected([]); setEx(NO_EXTRAS); }}>Libera tavoli</Button>
          <Button disabled={invalidSelected || invalidExtras} onClick={() => { if (invalidSelected || invalidExtras) return; onConfirm(selected, selected.length ? ex : NO_EXTRAS); onOpenChange(false); }}>Conferma</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
