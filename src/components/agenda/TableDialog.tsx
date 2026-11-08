import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { List, Map, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { canJoin, extraSeats, NO_EXTRAS, shiftName, useRooms, useTables, wallsOf, type Reservation, type TableExtras } from "@/lib/data";
import { GRID_COLS, GRID_ROWS } from "./RoomGrid";
import { FloorPlan } from "./FloorPlan";
import { isRoomClosedFor, isRoomClosed, tableState } from "@/lib/rotation";
import { useMembership, useSettings } from "@/lib/membership";
import { TableCards } from './TableCards';
import { suggestTables } from '@/lib/allocation';
import { compareTableNames } from '@/lib/data';
import { useActiveCustomRules, useTableHabits } from '@/lib/data';
import { serviceClock } from '@/lib/no-show';
import { useServiceClock } from '@/lib/extras';

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
      setForcedBusy([]);
      setForcedJoin([]);
      setEx(extras ? { extra_sponde: extras.extra_sponde, extra_barelle: extras.extra_barelle, barella_seats: extras.barella_seats || 2 } : NO_EXTRAS);
      const first = tables?.find((t) => reservation.table_ids.includes(t.id));
      try { setView(localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "map"); } catch { setView("map"); }
      setRoomId(first?.room_id ?? rooms?.find(r => !isRoomClosedFor(r, date, reservation.shift))?.id ?? rooms?.[0]?.id ?? null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const settings = useSettings();
  const customRules = useActiveCustomRules();
  const habits = useTableHabits(serviceClock(useServiceClock()).date);
  const isMaster = useMembership().data?.role === "master";
  const [force, setForce] = useState(false);
  /** Tavoli occupati che l'operatore ha scelto consapevolmente di forzare. */
  const [forcedBusy, setForcedBusy] = useState<string[]>([]);
  /** Tavoli uniti forzando consapevolmente un vincolo di non unione. */
  const [forcedJoin, setForcedJoin] = useState<string[]>([]);
  const [askJoin, setAskJoin] = useState<string | null>(null);
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
  const suggestion = rooms && tables ? suggestTables({ people:reservation.people,date,shift:reservation.shift,time:reservation.time,tables,rooms,others,cfg,outside:reservation.outside,notes:reservation.notes,rules:settings.assignmentRules,customRules,wallsFor,me:reservation,habits }) : null;
  const [view,setView] = useState<'cards'|'map'>('map');
  const pickView = (v: 'cards'|'map') => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage opzionale */ } };
  const invalidSelected = selTables.some(t=>stateOf(t.id).kind==='busy' && !forcedBusy.includes(t.id)) || selTables.some((a,i)=>selTables.slice(i+1).some(b=>!canJoin(a,b,wallsFor) && !forcedJoin.includes(a.id) && !forcedJoin.includes(b.id)));
  const toggle = (id: string) => {
    if (selected.includes(id)) return setSelected((s) => s.filter((x) => x !== id));
    const t = tables?.find((x) => x.id === id);
    if (!t) return;
    if (stateOf(id).kind==='busy' && !forcedBusy.includes(id)) return setAskBusy(id);
    if (t && !forcedJoin.includes(id) && selTables.some((o) => !canJoin(o, t, wallsFor))) return setAskJoin(id);
    const comodi = t.coperti_comodi ?? t.seats, max = Math.max(t.coperti_max ?? comodi, comodi);
    if (!selTables.length && reservation.people > comodi && reservation.people <= max) return setAskScomodo(id);
    setSelected((s) => [...s, id]);
  };
  const [askScomodo, setAskScomodo] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState<string | null>(null);
  const busyTable = tables?.find((t) => t.id === askBusy);
  const busyState = askBusy ? stateOf(askBusy) : null;
  const scomodoTable = tables?.find((t) => t.id === askScomodo);
  useEffect(() => { if (noExtras && (ex.extra_sponde || ex.extra_barelle)) setEx((e) => ({ ...e, extra_sponde: 0, extra_barelle: 0 })); }, [noExtras]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] w-[calc(100%-1rem)] max-w-[calc(100vw-1rem)] grid-cols-[minmax(0,1fr)] overflow-x-hidden sm:max-w-4xl overflow-y-auto bg-paper p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl sm:text-2xl">
            Assegna tavoli
          </DialogTitle>
          <p className="font-hand text-base text-muted-foreground sm:text-lg">
            {reservation.name || "Prenotazione"} · {reservation.people} persone · {shiftName(reservation.shift)}
          </p>
        </DialogHeader>

        <div className={cn("rounded-md border px-3 py-2 text-sm font-semibold", ok ? "border-free text-free" : "border-busy text-busy")}>
          Posti effettivi: {effective} / {reservation.people} coperti
        </div>
        {suggestion && !suggestion.ids.every(id=>selected.includes(id)) && <Button type="button" variant="outline" className="h-auto justify-start whitespace-normal border-warning bg-warning/10 py-2 text-left" onClick={()=>{ setSelected(suggestion.ids); setEx(suggestion.extras); }}>💡 Usa suggerito: {tables?.filter(t=>suggestion.ids.includes(t.id)).map(t=>`T.${t.name}`).join(' + ')}</Button>}

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
        {selected.length>1&&<div className="rounded-full border border-dashed border-primary bg-primary/5 px-4 py-2 text-center text-sm font-semibold text-primary">Tavoli {selTables.map(t=>t.name).join(' + ')} uniti</div>}
        {forcedJoin.some(id=>selected.includes(id))&&<p role="alert" className="rounded-md border border-warning bg-warning/15 px-3 py-2 text-sm font-semibold">⚠️ Unione forzata: questi tavoli normalmente non si uniscono, verifica la disposizione in sala.</p>}
        {forcedBusy.some(id=>selected.includes(id))&&<p role="alert" className="rounded-md border border-warning bg-warning/15 px-3 py-2 text-sm font-semibold">⚠️ Assegnazione forzata su tavolo occupato: verifica la rotazione in sala.</p>}
        <div className="sticky -bottom-3 z-20 -mx-3 space-y-2 border-t bg-paper px-3 pb-3 pt-2 shadow-[0_-6px_12px_-8px_hsl(0_0%_0%/0.3)] sm:-bottom-6 sm:-mx-6 sm:px-6 sm:pb-6">
          {invalidSelected&&<p role="alert" className="text-sm text-destructive">Assegnazione non disponibile: rimuovi i tavoli incompatibili.</p>}
          {invalidExtras&&<p role="alert" className="text-sm text-destructive">Prolunghe solo oltre 8 persone, massimo una per tavolo abilitato.</p>}
          <p role="status" aria-live="polite" className="truncate text-sm font-semibold">{selected.length ? `✓ ${selTables.map(t=>`T.${t.name}`).join(' + ')} · ${effective}/${reservation.people} posti` : 'Nessun tavolo selezionato'}</p>
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => { setSelected([]); setEx(NO_EXTRAS); }}>Libera tavoli</Button>
            <Button className="flex-1 sm:flex-none" size="lg" disabled={invalidSelected || invalidExtras} onClick={() => { if (invalidSelected || invalidExtras) return; onConfirm(selected, selected.length ? ex : NO_EXTRAS); onOpenChange(false); }}>Conferma</Button>
          </div>
        </div>
      </DialogContent>
      <AlertDialog open={!!askJoin} onOpenChange={(o) => { if (!o) setAskJoin(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>⚠️ Vincolo di unione tavoli</AlertDialogTitle>
            <AlertDialogDescription>Il Tavolo {tables?.find(t=>t.id===askJoin)?.name} normalmente non può essere unito ai tavoli selezionati (ostacolo, tavolo isola o vincolo impostato). Vuoi forzare comunque l'unione per necessità di servizio?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={() => { if (askJoin) { setForcedJoin((f) => [...f, askJoin]); setSelected((s) => [...s, askJoin]); } setAskJoin(null); }}>Forza unione</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!busyTable} onOpenChange={(o) => { if (!o) setAskBusy(null); }}>
        {busyTable && <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>⚠️ Tavolo già occupato</AlertDialogTitle>
            <AlertDialogDescription>Il Tavolo {busyTable.name} è già occupato{busyState?.kind==='busy' ? ` da ${busyState.name} fino alle ${busyState.until}` : ''}. Vuoi forzare comunque l'assegnazione in sovrapposizione?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={() => { setForcedBusy((f) => [...f, busyTable.id]); setSelected((s) => [...s, busyTable.id]); setAskBusy(null); }}>Forza assegnazione</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>}
      </AlertDialog>
      <AlertDialog open={!!scomodoTable} onOpenChange={(o) => { if (!o) setAskScomodo(null); }}>
        {scomodoTable && <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>⚠️ Assegnazione con Posti Scomodi</AlertDialogTitle>
            <AlertDialogDescription>Il Tavolo {scomodoTable.name} offre {scomodoTable.coperti_comodi ?? scomodoTable.seats} posti comodi (max {Math.max(scomodoTable.coperti_max ?? 0, scomodoTable.coperti_comodi ?? scomodoTable.seats)}). Per {reservation.people} persone la seduta sarà stretta o a ridosso del passaggio. Vuoi procedere?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annulla / Scegli altro</AlertDialogCancel><AlertDialogAction onClick={() => { setSelected((s) => [...s, scomodoTable.id]); setAskScomodo(null); }}>✅ Sì, Accomoda Comunque</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>}
      </AlertDialog>
    </Dialog>
  );
}
