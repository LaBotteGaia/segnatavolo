import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeftRight, RefreshCw, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { gridOf, shiftName, useReservations, useRooms, useTables, wallsOf, type Reservation, type RTable } from "@/lib/data";
import { useSettings } from "@/lib/membership";
import { useActiveRestaurantId } from "@/lib/tenant";
import { useServiceClock } from "@/lib/extras";
import { serviceClock } from "@/lib/no-show";
import { isRoomClosedFor } from "@/lib/rotation";
import { walkinClock, walkinValues, WALKIN_DEFAULT_PEOPLE } from "@/lib/service-actions";
import { refreshService } from "@/lib/recycle-bin";
import { liveCounters, liveTableState, movedTableIds, seatedSinceLabel, swappedTableIds, type LiveTableState } from "@/lib/live-floor";
import { supabase } from "@/integrations/supabase/client";

const CELL = 120;
type LiveRes = Pick<Reservation, "id" | "name" | "people" | "time" | "table_ids" | "arrived" | "duration_min" | "buffer_min" | "no_show">;
type Target = { res: LiveRes; tableId: string };

function useIsLandscape() {
  const [landscape, setLandscape] = useState(true);
  useEffect(() => {
    const mql = window.matchMedia("(orientation: landscape)");
    const fn = () => setLandscape(mql.matches);
    fn();
    mql.addEventListener("change", fn);
    return () => mql.removeEventListener("change", fn);
  }, []);
  return landscape;
}

/** Modalità Servizio Live: HUD a tutto schermo, solo orizzontale, per monitorare la sala e spostare/accomodare al volo. */
export function LiveFloorMode({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const landscape = useIsLandscape();
  const now = useServiceClock();
  const settings = useSettings();
  const qc = useQueryClient();
  const restaurantId = useActiveRestaurantId();
  const clock = serviceClock(now);
  const walk = walkinClock(now, settings);
  const shift = walk.shift;
  const { data: allRows = [] } = useReservations(clock.date);
  const { data: rooms = [] } = useRooms();
  const { data: tables = [] } = useTables();
  const rows = useMemo(() => allRows.filter((r) => r.shift === shift), [allRows, shift]);
  const openRooms = useMemo(() => rooms.filter((r) => !isRoomClosedFor(r, clock.date, shift)), [rooms, clock.date, shift]);
  const [roomId, setRoomId] = useState("");
  const room = openRooms.find((r) => r.id === roomId) ?? openRooms[0];
  const roomTables = useMemo(() => tables.filter((t) => t.room_id === room?.id), [tables, room?.id]);
  const [selected, setSelected] = useState<Target | null>(null);
  const [moving, setMoving] = useState<Target | null>(null);
  const [walkin, setWalkin] = useState<{ people: number; name: string } | null>(null);
  const [seating, setSeating] = useState<{ people: number; name: string } | null>(null);
  const [confirmFreed, setConfirmFreed] = useState<{ table: RTable; occName: string; until: string } | null>(null);
  const [swap, setSwap] = useState<{ from: Target; to: Target } | null>(null);
  const [busy, setBusy] = useState(false);

  const stateOf = (id: string): LiveTableState => liveTableState(id, rows, clock.minutes, settings);
  const counters = liveCounters(roomTables, rows, clock.minutes, settings);
  const tableName = (id: string) => tables.find((t) => t.id === id)?.name ?? "?";

  const reset = () => { setSelected(null); setMoving(null); setWalkin(null); setSeating(null); setConfirmFreed(null); setSwap(null); setBusy(false); };
  const close = () => { reset(); onOpenChange(false); };

  useEffect(() => {
    if (!open) return;
    reset();
    const el = document.documentElement;
    void el.requestFullscreen?.().then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.("landscape")?.catch(() => {})).catch(() => {});
    return () => {
      try { (screen.orientation as unknown as { unlock?: () => void })?.unlock?.(); } catch { /* non supportato */ }
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const updateTables = async (resId: string, ids: string[]) => {
    const { error } = await supabase.from("reservations").update({ table_ids: ids }).eq("id", resId).eq("restaurant_id", restaurantId ?? "");
    if (error) throw new Error(error.message);
  };

  const doMove = async (from: Target, to: RTable) => {
    setBusy(true);
    try {
      await updateTables(from.res.id, movedTableIds(from.res.table_ids, from.tableId, to.id));
      toast.success(`Comitiva ${from.res.name} spostata dal T.${tableName(from.tableId)} al T.${to.name}`);
      await refreshService(qc);
      setMoving(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Spostamento non riuscito"); }
    finally { setBusy(false); }
  };

  const doSwap = async () => {
    if (!swap) return;
    setBusy(true);
    try {
      const s = swappedTableIds(swap.from.res.table_ids, swap.to.res.table_ids, swap.from.tableId, swap.to.tableId);
      await updateTables(swap.from.res.id, s.a);
      await updateTables(swap.to.res.id, s.b);
      toast.success(`Tavoli scambiati: ${swap.from.res.name} ⇄ ${swap.to.res.name}`);
      await refreshService(qc);
      setSwap(null); setMoving(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Scambio non riuscito"); }
    finally { setBusy(false); }
  };

  const doWalkin = async (table: RTable) => {
    if (!seating) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_service_walkin", walkinValues(seating.name, seating.people, table.id));
      if (error) { toast.error(error.message); await refreshService(qc); return; }
      toast.success(`${seating.name.trim() || "Passante"} accomodato al T.${table.name}`);
      await refreshService(qc);
      setSeating(null);
    } finally { setBusy(false); }
  };

  const doWalkinFreed = async () => {
    if (!confirmFreed || !seating) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("seat_walkin_freed", walkinValues(seating.name, seating.people, confirmFreed.table.id));
      if (error) { toast.error(error.message); await refreshService(qc); return; }
      toast.success(`T.${confirmFreed.table.name} liberato (${confirmFreed.occName} uscito): nuova comitiva accomodata`);
      await refreshService(qc);
      setConfirmFreed(null); setSeating(null);
    } finally { setBusy(false); }
  };

  const onTableTap = (t: RTable) => {
    if (busy) return;
    const st = stateOf(t.id);
    if (moving) {
      if (t.id === moving.tableId) return setMoving(null);
      if (st.kind === "free") return void doMove(moving, t);
      if (st.kind === "seated") return setSwap({ from: moving, to: { res: st.res, tableId: t.id } });
      return toast.warning(`Tavolo ${t.name} riservato a breve (${st.at})`);
    }
    if (seating) {
      if (st.kind === "free") return void doWalkin(t);
      if (st.kind === "seated") return setConfirmFreed({ table: t, occName: st.res.name, until: st.until });
      return toast.warning(`Tavolo ${t.name} riservato a breve (${st.at})`);
    }
    if (st.kind === "seated") setSelected({ res: st.res, tableId: t.id });
  };

  const grid = gridOf(room);
  const cols = Math.max(grid.cols, ...roomTables.map((t) => t.x + 1), 1);
  const rowsN = Math.max(grid.rows, ...roomTables.map((t) => t.y + 1), 1);
  const walls = wallsOf(room);
  const dateLabel = format(parseISO(clock.date), "EEEE d MMMM", { locale: it }).replace(/^\w/, (c) => c.toUpperCase());

  if (!landscape) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-desk p-6 text-center text-primary-foreground" data-no-swipe>
        <span className="live-rotate text-7xl" aria-hidden>📱</span>
        <p className="max-w-sm font-display text-2xl leading-snug">Ruota il dispositivo in orizzontale per accedere alla Modalità di Lavoro Live</p>
        <Button variant="secondary" size="lg" onClick={close}><X /> Chiudi</Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-desk text-primary-foreground" data-no-swipe role="dialog" aria-label="Modalità Sala Live">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-primary-foreground/10 px-3 py-2">
        <h2 className="font-display text-lg leading-none">{shiftName(shift).toUpperCase()} — {dateLabel}</h2>
        <Button size="sm" variant="secondary" onClick={() => { setSelected(null); setMoving(null); setWalkin({ people: WALKIN_DEFAULT_PEOPLE, name: "Passante" }); }}>
          <Zap /> Accomoda al Volo
        </Button>
        <div role="tablist" aria-label="Sale" className="flex flex-wrap gap-1">
          {openRooms.map((r) => (
            <Button key={r.id} type="button" role="tab" aria-selected={room?.id === r.id} size="sm"
              variant={room?.id === r.id ? "secondary" : "ghost"}
              className={cn(room?.id !== r.id && "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground")}
              onClick={() => setRoomId(r.id)}>{r.name}</Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs font-semibold uppercase tracking-wide">
          <span>🪑 Seduti <b className="text-base">{counters.seatedCovers}</b></span>
          <span className="text-free">Liberi <b className="text-base">{counters.freeTables}</b></span>
          <span className="text-warning">In arrivo <b className="text-base">{counters.incomingTables}</b></span>
        </div>
        <Button size="icon" variant="secondary" aria-label="Esci dalla Modalità Sala Live" title="Esci dalla Modalità Sala Live" onClick={close} className="ml-2"><X /></Button>
      </header>

      {(moving || seating) && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-primary-foreground/10 bg-primary-foreground/10 px-3 py-1.5 text-sm font-semibold">
          <span>{moving ? `Spostamento di ${moving.res.name}: tocca il tavolo di destinazione` : `Accomoda ${seating!.people} ${seating!.people === 1 ? "persona" : "persone"}: tocca il tavolo sulla mappa`}</span>
          <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => { setMoving(null); setSeating(null); }}>Annulla</Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!room && <p className="p-6 text-center">Nessuna sala aperta in questo turno.</p>}
        {room && (
          <div className="relative mx-auto select-none" style={{ width: cols * CELL + 24, height: rowsN * CELL + 24 }}>
            <svg aria-hidden className="pointer-events-none absolute inset-3 text-primary-foreground/60" width={cols * CELL} height={rowsN * CELL} viewBox={`0 0 ${cols * CELL} ${rowsN * CELL}`}>
              {walls.map((key) => {
                const [kind, sx, sy] = key.split(":");
                const x = Number(sx) * CELL, y = Number(sy) * CELL;
                if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                if (kind === "o") return <g key={key} stroke="currentColor" strokeWidth="4"><path d={`M${x + 30},${y + 30} l60,60 M${x + 90},${y + 30} l-60,60`} /></g>;
                if (kind !== "h" && kind !== "v") return null;
                return <line key={key} x1={x} y1={y} x2={kind === "h" ? x + CELL : x} y2={kind === "v" ? y + CELL : y} stroke="currentColor" strokeWidth="6" strokeLinecap="round" />;
              })}
            </svg>
            {roomTables.map((t) => {
              const st = stateOf(t.id);
              const flashing = (moving || seating) && st.kind === "free";
              return (
                <div key={t.id} className="absolute" style={{ left: t.x * CELL + 16, top: t.y * CELL + 16, width: CELL - 16, height: CELL - 16 }}>
                  <button type="button" onClick={() => onTableTap(t)} aria-label={`Tavolo ${t.name}`}
                    className={cn("flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-md border-2 p-1 text-center leading-tight transition-colors",
                      st.kind === "seated" ? "border-busy bg-busy text-busy-foreground" : st.kind === "incoming" ? "border-warning bg-warning/25 text-primary-foreground" : "border-free bg-free/15 text-primary-foreground",
                      flashing && "live-flash")}>
                    <span className="text-2xl font-bold">T.{t.name}</span>
                    {st.kind === "seated" ? (
                      <>
                        <span className="line-clamp-1 max-w-full text-xs font-semibold">{st.res.name} · {st.res.people}p</span>
                        <span className="text-[10px]">{seatedSinceLabel(st.sinceMin)}</span>
                      </>
                    ) : st.kind === "incoming" ? (
                      <>
                        <span className="line-clamp-1 max-w-full text-xs font-semibold">{st.res.name}</span>
                        <span className="text-[10px]">Arriva {st.at}</span>
                      </>
                    ) : (
                      <span className="text-[10px]">{t.seats} posti · Libero</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-card p-4 text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl">T.{tableName(selected.tableId)} · {selected.res.name}</h3>
            <p className="text-sm text-muted-foreground">{selected.res.people} coperti · arrivo {selected.res.time} · {seatedSinceLabel(Math.max(0, clock.minutes - (Number(selected.res.time.split(":")[0]) * 60 + Number(selected.res.time.split(":")[1]))))}</p>
            <Button className="h-12 w-full" disabled={busy} onClick={() => { setMoving(selected); setSelected(null); }}>
              <RefreshCw /> 🔄 Sposta su altro tavolo
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>Chiudi</Button>
          </div>
        </div>
      )}

      {swap && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/50 p-4" onClick={() => setSwap(null)}>
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-card p-4 text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl">Tavolo {tableName(swap.to.tableId)} occupato</h3>
            <p className="text-sm">Il T.{tableName(swap.to.tableId)} è occupato da <b>{swap.to.res.name}</b>. Vuoi invertire i due tavoli con un solo tocco?</p>
            <Button className="h-14 w-full text-base" disabled={busy} onClick={doSwap}><ArrowLeftRight /> 🔀 Scambia Tavoli</Button>
            <Button variant="outline" className="w-full" onClick={() => setSwap(null)}>Annulla</Button>
          </div>
        </div>
      )}

      {walkin && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/50 p-4" onClick={() => setWalkin(null)}>
          <div className="w-full max-w-md space-y-3 rounded-lg bg-card p-4 text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex items-center gap-2 font-display text-xl"><Zap /> Accomoda al volo</h3>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <Button key={n} type="button" className="h-12 text-lg" variant={walkin.people === n ? "default" : "outline"} aria-pressed={walkin.people === n} onClick={() => setWalkin({ ...walkin, people: n })}>{n}</Button>
              ))}
            </div>
            <div>
              <Label htmlFor="live-walkin-name">Nome / Riferimento (facoltativo)</Label>
              <Input id="live-walkin-name" value={walkin.name} onChange={(e) => setWalkin({ ...walkin, name: e.target.value })} />
            </div>
            <Button className="h-12 w-full" onClick={() => { setSeating(walkin); setWalkin(null); }}>Scegli il tavolo sulla mappa</Button>
            <Button variant="outline" className="w-full" onClick={() => setWalkin(null)}>Annulla</Button>
          </div>
        </div>
      )}

      {confirmFreed && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/50 p-4" onClick={() => setConfirmFreed(null)}>
          <div className="w-full max-w-md space-y-3 rounded-lg bg-card p-4 text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl">⚠️ Tavolo {confirmFreed.table.name} occupato</h3>
            <p className="text-sm">Il Tavolo {confirmFreed.table.name} risulta occupato da <b>{confirmFreed.occName}</b> (fine prevista {confirmFreed.until}).<br />Il tavolo è già stato liberato e sparecchiato?</p>
            <Button className="h-14 w-full text-base" disabled={busy} onClick={doWalkinFreed}>✅ Sì, Tavolo Liberato — Accomoda Qui</Button>
            <Button variant="outline" className="h-12 w-full" onClick={() => setConfirmFreed(null)}>Annulla</Button>
          </div>
        </div>
      )}
    </div>
  );
}
