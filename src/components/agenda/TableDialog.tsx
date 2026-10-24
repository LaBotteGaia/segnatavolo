import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { canJoin, gridOf, extraSeats, NO_EXTRAS, shiftName, useRooms, useTables, wallsOf, type Reservation, type TableExtras } from "@/lib/data";
import { RoomGrid, GRID_COLS, GRID_ROWS } from "./RoomGrid";
import { isRoomClosedFor, isRoomClosed, tableState } from "@/lib/rotation";
import { useMembership, useSettings } from "@/lib/membership";
import { TableCards } from './TableCards';
import { suggestTables } from '@/lib/allocation';
import { compareTableNames } from '@/lib/data';

export { GRID_COLS, GRID_ROWS };

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
      setRoomId(first?.room_id ?? null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const settings = useSettings();
  const isMaster = useMembership().data?.role === "master";
  const [force, setForce] = useState(false);
  const cfg = { duration: settings.duration, buffer: settings.buffer };
  const stateOf = useMemo(() => {
    const sameShift = others.filter((o) => o.id !== reservation.id);
    return (id: string) => tableState(id, reservation, sameShift, cfg);
  }, [others, reservation, cfg.duration, cfg.buffer]); // eslint-disable-line react-hooks/exhaustive-deps

  const roomTables = tables?.filter((t) => t.room_id === roomId) ?? [];
  const nominal = tables?.filter((t) => selected.includes(t.id)).reduce((s, t) => s + (t.coperti_comodi ?? t.seats), 0) ?? 0;
  const effective = nominal + (selected.length ? extraSeats(ex) : 0);
  const room = rooms?.find((r) => r.id === roomId);
  const over = selected.length > 0 && nominal < reservation.people;
  const ok = effective >= reservation.people;

  const selTables = tables?.filter((t) => selected.includes(t.id)) ?? [];
  const noExtras = selTables.length > 0 && selTables.every((t) => !t.allow_extras);
  const wallsFor = (rid: string) => wallsOf(rooms?.find((r) => r.id === rid));
  const suggestion = rooms && tables ? suggestTables({ people:reservation.people,date,shift:reservation.shift,time:reservation.time,tables,rooms,others,cfg,outside:reservation.outside,notes:reservation.notes,rules:settings.assignmentRules,wallsFor,me:reservation }) : null;
  const [view,setView] = useState<'cards'|'map'>('cards');
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
      <DialogContent className="max-h-[95vh] max-w-2xl overflow-y-auto bg-paper">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {room ? (
              <Button variant="ghost" className="h-auto justify-start p-0 font-display text-2xl" onClick={() => setRoomId(null)}>
                <ChevronLeft className="h-5 w-5" /> {room.name}
              </Button>
            ) : "Scegli la sala"}
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Posti per barella:
              {[1, 2].map((n) => (
                <button key={n} type="button" onClick={() => setEx({ ...ex, barella_seats: n })}
                  className={cn("rounded-md border px-2 py-0.5 font-semibold", ex.barella_seats === n ? "bg-primary text-primary-foreground" : "bg-card")}>+{n}</button>
              ))}
            </div>
            {ok && <p className="text-sm font-semibold text-free">✓ Coperti raggiunti</p>}
          </div>
        )}

        {!room ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {rooms?.map((r) => {
              const count = tables?.filter((t) => t.room_id === r.id && selected.includes(t.id)).length ?? 0;
              const shut = isRoomClosedFor(r, date, reservation.shift);
              return (
                <button key={r.id} onClick={() => setRoomId(r.id)} className={cn("rounded-md border bg-card p-4 text-left font-display text-lg hover:bg-accent", shut && "opacity-50")}>
                  {r.name}
                  {shut && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-sans text-xs font-bold text-muted-foreground">{isRoomClosed(r, date) ? "❄️ Chiusa per stagione" : `🚫 Chiusa per il turno ${shiftName(reservation.shift)}`}</span>}
                  {count > 0 && <span className="ml-2 text-sm text-primary">({count} selezionati)</span>}
                </button>
              );
            })}
            {!rooms?.length && <p className="text-muted-foreground">Nessuna sala. Creala dal menù ☰ → Gestione Sale e Mappe.</p>}
          </div>
        ) : (
          <>
          {isRoomClosedFor(room, date, reservation.shift) && (
            <div className="rounded-md border border-muted-foreground/40 bg-muted p-3 text-sm">
              <p className="font-bold">{isRoomClosed(room, date) ? "❄️ Chiusa per stagione: in questa data i tavoli di questa sala non sono assegnabili." : `🚫 Chiusa per il turno ${shiftName(reservation.shift)}: i tavoli di questa sala non sono assegnabili.`}</p>
              {isMaster && <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Forza comunque l'assegnazione (solo Master)</label>}
            </div>
          )}
          <div className="flex gap-2"><Button variant={view==='cards'?'secondary':'ghost'} onClick={()=>setView('cards')}>Tavoli</Button><Button variant={view==='map'?'secondary':'ghost'} onClick={()=>setView('map')}>Mappa sala</Button></div>
          {view==='cards' ? <TableCards tables={[...roomTables].sort((a,b)=>compareTableNames(a.name,b.name))} room={room} selected={selected} suggested={suggestion?.ids??[]} people={reservation.people} stateOf={stateOf} closed={isRoomClosedFor(room,date,reservation.shift)&&!force} onToggle={toggle}/> : <RoomGrid
            cols={gridOf(room).cols}
            rows={gridOf(room).rows}
            tables={roomTables}
            walls={wallsOf(room)}
            renderCell={(_x, _y, t) => {
              if (!t) return <div className="h-full w-full rounded-md border border-dashed border-rule" />;
              const stt = stateOf(t.id);
              const busy = stt.kind === "busy" ? stt.name || "—" : undefined;
              const sel = selected.includes(t.id);
              const shut = isRoomClosedFor(room, date, reservation.shift) && !force;
              return (
                <button
                  disabled={!!busy || (shut && !sel)}
                  onClick={() => toggle(t.id)}
                  className={cn(
                    "relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-md p-0.5 text-center font-bold leading-tight transition",
                    busy ? "bg-busy text-busy-foreground opacity-90" : shut ? "bg-muted text-muted-foreground" : stt.kind === "limited" ? "bg-warning text-ink" : "bg-free text-free-foreground",
                    sel && "ring-4 ring-primary ring-offset-2 ring-offset-paper",
                  )}
                >
                  <span>{t.name} - {t.seats}p</span>
                  {!t.allow_extras && <span className="absolute right-0.5 top-0 text-[0.8em]" title="Niente sponde/barelle">⛔</span>}
                  {stt.kind === "busy" && <span className="max-w-full truncate text-[0.75em] font-normal">Occupato fino alle {stt.until}</span>}
                  {stt.kind === "limited" && <span className="max-w-full truncate text-[0.75em] font-normal">Disponibile fino alle {stt.until}</span>}
                </button>
              );
            }}
          />}
          </>
        )}

        {selected.length>1&&<div className="rounded-full border border-dashed border-primary bg-primary/5 px-4 py-2 text-center text-sm font-semibold text-primary">Tavoli {selTables.map(t=>t.name).join(' + ')} uniti</div>}
        {invalidSelected&&<p role="alert" className="text-sm text-destructive">Assegnazione non disponibile: rimuovi i tavoli occupati o incompatibili.</p>}
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => { setSelected([]); setEx(NO_EXTRAS); }}>Libera tavoli</Button>
          <Button disabled={invalidSelected} onClick={() => { if (invalidSelected) return; onConfirm(selected, selected.length ? ex : NO_EXTRAS); onOpenChange(false); }}>Conferma</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
