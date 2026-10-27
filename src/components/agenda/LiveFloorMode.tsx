import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeftRight, Minus, Plus, RefreshCw, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { compareTables, shiftName, useReservations, useRooms, useTables, type RTable } from "@/lib/data";
import { useSettings, useWalkinBuffer } from "@/lib/membership";
import { useActiveRestaurantId } from "@/lib/tenant";
import { useServiceClock } from "@/lib/extras";
import { serviceClock } from "@/lib/no-show";
import { isRoomClosedFor } from "@/lib/rotation";
import { walkinClock, walkinValues, WALKIN_DEFAULT_PEOPLE } from "@/lib/service-actions";
import { refreshService } from "@/lib/recycle-bin";
import { arrivalsLists, hoursMinutes, limitedStay, liveCounters, liveTableState, maxStayBadge, movedTableIds, nextBookingOn, seatedSinceLabel, swappedTableIds, type LiveRes, type LiveTableState } from "@/lib/live-floor";
import { supabase } from "@/integrations/supabase/client";

type Target = { res: LiveRes; tableId: string };
type WalkinDraft = { people: number; name: string; targetId?: string };
const ZOOM_MIN = 0.6, ZOOM_MAX = 1.6, ZOOM_STEP = 0.2;

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

/** Modalità Servizio Live: HUD a tutto schermo, solo orizzontale, con colonna arrivi e griglia tavoli ordinata. */
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
  const gridTables = useMemo(() => {
    const open = new Set(openRooms.map((r) => r.id));
    return tables.filter((t) => open.has(t.room_id)).sort(compareTables(openRooms));
  }, [tables, openRooms]);
  const lists = useMemo(() => arrivalsLists(rows), [rows]);
  const [selected, setSelected] = useState<Target | null>(null);
  const [moving, setMoving] = useState<Target | null>(null);
  const [walkin, setWalkin] = useState<WalkinDraft | null>(null);
  const [seating, setSeating] = useState<{ people: number; name: string } | null>(null);
  const [confirmFreed, setConfirmFreed] = useState<{ table: RTable; occName: string; until: string } | null>(null);
  const walkinBuffer = useWalkinBuffer();
  const [limited, setLimited] = useState<{ table: RTable; w: { people: number; name: string }; nextName: string; nextAt: string; until: string; minutes: number } | null>(null);
  const [swap, setSwap] = useState<{ from: Target; to: Target } | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState<string | null>(null);

  const stateOf = (id: string): LiveTableState => liveTableState(id, rows, clock.minutes, settings);
  const counters = liveCounters(gridTables, rows, clock.minutes, settings);
  const tableName = (id: string) => tables.find((t) => t.id === id)?.name ?? "?";
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "Sala";

  const reset = () => { setSelected(null); setMoving(null); setWalkin(null); setSeating(null); setConfirmFreed(null); setLimited(null); setSwap(null); setBusy(false); setFocus(null); };
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

  useEffect(() => {
    if (!focus) return;
    document.getElementById(`live-t-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setFocus(null), 2600);
    return () => clearTimeout(t);
  }, [focus]);

  if (!open) return null;

  const updateTables = async (resId: string, ids: string[]) => {
    const { error } = await supabase.from("reservations").update({ table_ids: ids }).eq("id", resId).eq("restaurant_id", restaurantId ?? "");
    if (error) throw new Error(error.message);
  };

  /** Spunta arrivo identica all'agenda: arrived + reset no_show, sincronizzata via Realtime. */
  const setArrived = async (r: LiveRes, v: boolean) => {
    const { error } = await supabase.from("reservations").update({ arrived: v, no_show: false }).eq("id", r.id).eq("restaurant_id", restaurantId ?? "");
    if (error) toast.error(error.message);
    else await refreshService(qc);
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

  const doWalkin = async (table: RTable, w: { people: number; name: string }) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_service_walkin", walkinValues(w.name, w.people, table.id));
      if (error) { toast.error(error.message); await refreshService(qc); return; }
      toast.success(`${w.name.trim() || "Passante"} accomodato al T.${table.name}`);
      await refreshService(qc);
      setSeating(null);
    } finally { setBusy(false); }
  };

  /** Tavolo libero ora: se una prenotazione successiva taglia la seduta standard chiede la permanenza vincolata. */
  const tryWalkin = (table: RTable, w: { people: number; name: string }) => {
    const next = nextBookingOn([table.id], rows, clock.minutes);
    const lim = next ? limitedStay(toMinLocal(next.time), clock.minutes, { ...settings, buffer: walkinBuffer }) : null;
    if (!next || !lim) return void doWalkin(table, w);
    if (!lim.allowed) return toast.warning(`Tavolo ${table.name} prenotato alle ${next.time}: tempo insufficiente`);
    return setLimited({ table, w, nextName: next.name, nextAt: next.time, until: lim.until, minutes: lim.minutes });
  };

  const doWalkinLimited = async () => {
    if (!limited) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("seat_walkin_limited", walkinValues(limited.w.name, limited.w.people, limited.table.id));
      if (error) { toast.error(error.message); await refreshService(qc); return; }
      toast.success(`${limited.w.name.trim() || "Passante"} accomodato al T.${limited.table.name}: uscita entro le ${data ?? limited.until}`);
      await refreshService(qc);
      setLimited(null); setSeating(null);
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

  /** Conferma della modale walk-in: con tavolo già scelto accomoda subito (o chiede la liberazione), altrimenti si tocca la griglia. */
  const confirmWalkin = () => {
    if (!walkin) return;
    const w = { people: walkin.people, name: walkin.name };
    if (walkin.targetId) {
      const t = tables.find((x) => x.id === walkin.targetId);
      setWalkin(null);
      if (!t) return;
      const st = stateOf(t.id);
      if (st.kind === "seated") { setSeating(w); return setConfirmFreed({ table: t, occName: st.res.name, until: st.until }); }
      return tryWalkin(t, w);
    }
    setSeating(w);
    setWalkin(null);
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
      if (st.kind === "seated") return setConfirmFreed({ table: t, occName: st.res.name, until: st.until });
      return tryWalkin(t, seating);
    }
    if (st.kind === "free" || st.kind === "incoming") return setWalkin({ people: WALKIN_DEFAULT_PEOPLE, name: "Passante", targetId: t.id });
    if (st.kind === "seated") setSelected({ res: st.res, tableId: t.id });
  };

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

  const resCard = (r: LiveRes) => (
    <div key={r.id} className={cn("flex items-start gap-2 rounded-md border border-primary-foreground/15 bg-primary-foreground/5 p-2", focus && r.table_ids.includes(focus) && "ring-2 ring-free")}
      onClick={() => r.table_ids[0] && setFocus(r.table_ids[0])} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" && r.table_ids[0]) setFocus(r.table_ids[0]); }}>
      <Checkbox className="mt-0.5 size-6 shrink-0" aria-label={`Arrivato: ${r.name}`} checked={r.arrived}
        onClick={(e) => e.stopPropagation()} onCheckedChange={(v) => void setArrived(r, v === true)} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="font-semibold">{r.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="rounded bg-secondary px-1.5 py-0.5 font-bold text-secondary-foreground">T. {r.table_ids.map(tableName).join("+") || "—"}</span>
          <span>👥 {r.people} pax</span>
          <span>🕐 {r.time}</span>
        </p>
        <MaxStay until={r.max_stay_until} now={clock.minutes} />
        {r.notes && <p className="mt-1 inline-block rounded-full bg-warning/25 px-2 py-0.5 text-[11px]">{r.notes}</p>}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-desk text-primary-foreground" data-no-swipe role="dialog" aria-label="Modalità Sala Live">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-primary-foreground/10 px-3 py-2">
        <h2 className="font-display text-lg leading-none">{shiftName(shift).toUpperCase()} — {dateLabel}</h2>
        <Button size="sm" variant="secondary" onClick={() => { setSelected(null); setMoving(null); setWalkin({ people: WALKIN_DEFAULT_PEOPLE, name: "Passante" }); }}>
          <Zap /> Accomoda al Volo
        </Button>
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide">
          <span>🪑 Seduti <b className="text-base">{counters.seatedCovers}</b></span>
          <span className="text-free">Liberi <b className="text-base">{counters.freeTables}</b></span>
          <span className="text-warning">In arrivo <b className="text-base">{counters.incomingTables}</b></span>
        </div>
        <div className="ml-auto flex items-center gap-1" aria-label="Zoom griglia tavoli">
          <Button size="icon" variant="secondary" aria-label="Riduci zoom" disabled={zoom <= ZOOM_MIN} onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(1)))}><Minus /></Button>
          <Button variant="secondary" className="min-w-16" aria-label="Reimposta zoom" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</Button>
          <Button size="icon" variant="secondary" aria-label="Aumenta zoom" disabled={zoom >= ZOOM_MAX} onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(1)))}><Plus /></Button>
        </div>
        <Button size="icon" variant="secondary" aria-label="Esci dalla Modalità Sala Live" title="Esci dalla Modalità Sala Live" onClick={close} className="ml-1"><X /></Button>
      </header>

      {(moving || seating) && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-primary-foreground/10 bg-primary-foreground/10 px-3 py-1.5 text-sm font-semibold">
          <span>{moving ? `Spostamento di ${moving.res.name}: tocca il tavolo di destinazione` : `Accomoda ${seating!.people} ${seating!.people === 1 ? "persona" : "persone"}: tocca il tavolo sulla griglia`}</span>
          <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => { setMoving(null); setSeating(null); }}>Annulla</Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-primary-foreground/10 p-3" aria-label="Gestione arrivi">
          <h3 className="font-display text-base">Ospiti Turno — {shiftName(shift)}</h3>
          <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-warning">In Arrivo ({lists.incoming.length})</p>
          <div className="space-y-2">
            {lists.incoming.map(resCard)}
            {!lists.incoming.length && <p className="text-xs opacity-70">Nessun ospite in arrivo.</p>}
          </div>
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-free">Arrivati / Seduti ({lists.seated.length})</p>
          <div className="space-y-2">
            {lists.seated.map(resCard)}
            {!lists.seated.length && <p className="text-xs opacity-70">Nessun ospite ancora seduto.</p>}
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-auto p-3">
          {!gridTables.length && <p className="p-6 text-center">Nessuna sala aperta in questo turno.</p>}
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` }}>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {gridTables.map((t) => {
                const st = stateOf(t.id);
                const flashing = (moving || seating) && st.kind === "free";
                return (
                  <button key={t.id} id={`live-t-${t.id}`} type="button" onClick={() => onTableTap(t)} aria-label={`Tavolo ${t.name}`}
                    className={cn("flex min-h-28 flex-col items-center justify-center gap-0.5 rounded-md border-2 p-2 text-center leading-tight transition-colors",
                      st.kind === "seated" ? "border-busy bg-busy text-busy-foreground" : st.kind === "incoming" ? "border-warning bg-warning/25 text-primary-foreground" : "border-free bg-free/15 text-primary-foreground",
                      flashing && "live-flash", focus === t.id && "ring-4 ring-free")}>
                    <span className="text-2xl font-bold">T.{t.name}</span>
                    <span className="text-[10px] uppercase tracking-wide opacity-80">{roomName(t.room_id)}</span>
                    <span className="text-[10px]">{(t.coperti_comodi ?? t.seats)}-{(t.coperti_max ?? t.seats)} pax</span>
                    {st.kind === "seated" ? (
                      <>
                        <span className="max-w-full break-words text-xs font-semibold">{st.res.name} · {st.res.people}p</span>
                        <span className="text-[10px]">{seatedSinceLabel(st.sinceMin)}</span>
                        <MaxStay until={st.res.max_stay_until} now={clock.minutes} />
                      </>
                    ) : st.kind === "incoming" ? (
                      <>
                        <span className="max-w-full break-words text-xs font-semibold">{st.res.name}</span>
                        <span className="text-[10px]">Arriva {st.at}</span>
                      </>
                    ) : (
                      <span className="text-[10px] font-semibold text-free">Libero</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-card p-4 text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl">T.{tableName(selected.tableId)} · {selected.res.name}</h3>
            <p className="text-sm text-muted-foreground">{selected.res.people} coperti · arrivo {selected.res.time} · {seatedSinceLabel(Math.max(0, clock.minutes - (Number(selected.res.time.split(":")[0]) * 60 + Number(selected.res.time.split(":")[1]))))}</p>
            <Button className="h-12 w-full" disabled={busy} onClick={() => { setMoving(selected); setSelected(null); }}>
              <RefreshCw /> 🔄 Sposta su altro tavolo
            </Button>
            <Button variant="secondary" className="h-12 w-full" disabled={busy} onClick={() => { setWalkin({ people: WALKIN_DEFAULT_PEOPLE, name: "Passante", targetId: selected.tableId }); setSelected(null); }}>
              <Zap /> ⚡ Nuova comitiva (tavolo già liberato)
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
            <h3 className="flex items-center gap-2 font-display text-xl"><Zap /> Accomoda al volo{walkin.targetId ? ` — T.${tableName(walkin.targetId)}` : ""}</h3>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <Button key={n} type="button" className="h-12 text-lg" variant={walkin.people === n ? "default" : "outline"} aria-pressed={walkin.people === n} onClick={() => setWalkin({ ...walkin, people: n })}>{n}</Button>
              ))}
            </div>
            <div>
              <Label htmlFor="live-walkin-name">Nome / Riferimento (facoltativo)</Label>
              <Input id="live-walkin-name" value={walkin.name} onChange={(e) => setWalkin({ ...walkin, name: e.target.value })} />
            </div>
            <Button className="h-12 w-full" onClick={confirmWalkin}>{walkin.targetId ? "Accomoda su questo tavolo" : "Scegli il tavolo sulla griglia"}</Button>
            <Button variant="outline" className="w-full" onClick={() => setWalkin(null)}>Annulla</Button>
          </div>
        </div>
      )}

      {limited && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/50 p-4" onClick={() => setLimited(null)}>
          <div className="w-full max-w-md space-y-3 rounded-lg bg-card p-4 text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl">⚠️ Tavolo {limited.table.name} prenotato alle {limited.nextAt} da {limited.nextName}</h3>
            <p className="text-sm">Tempo massimo di permanenza disponibile: <b>{hoursMinutes(limited.minutes)}</b> (fino alle {limited.until}).<br />Considerando {walkinBuffer} minuti di riassetto, la permanenza massima è fino alle {limited.until}.<br />Vuoi procedere con la permanenza vincolata?</p>
            <Button className="h-14 w-full text-base" disabled={busy} onClick={doWalkinLimited}>✅ Conferma con uscita entro le {limited.until}</Button>
            <Button variant="outline" className="h-12 w-full" onClick={() => setLimited(null)}>Annulla / Scegli altro tavolo</Button>
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

const toMinLocal = (t: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };

/** Badge ⏳ della permanenza massima; lampeggia in rosso negli ultimi 15 minuti. */
export function MaxStay({ until, now }: { until?: string | null | undefined; now: number }) {
  const b = maxStayBadge(until, now);
  if (!b) return null;
  return <span className={cn("mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-bold", b.urgent ? "animate-pulse bg-destructive text-destructive-foreground" : "bg-warning text-foreground")}>{b.label}</span>;
}
