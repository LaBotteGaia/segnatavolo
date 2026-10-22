import { ServiceHub } from "@/components/agenda/ServiceHub";
import { OnlineRequests } from "@/components/agenda/OnlineRequests";
import { WalkInDialog } from "@/components/agenda/WalkInDialog";
import { UNDO_DURATION } from "@/lib/service-actions";
import { refreshService, restoreReservation } from "@/lib/recycle-bin";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayExtra } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { activeShifts, closedShifts, isDayClosed, monthReservationsQuery, shiftCounters, shiftEmoji, shiftName, shiftPlural, useReservations, useRooms, useTables, type DotLevel, type Reservation, type Shift } from "@/lib/data";
import { affluenceLevel, zoneCapacities, zoneTip, type Affluence } from "@/lib/affluence";
import { useSettings } from "@/lib/membership";
import { useActiveRestaurantId } from "@/lib/tenant";
import { useNewReservationNotifications } from "@/lib/notifications";
import { ReservationRow, ROW_GRID } from "@/components/agenda/ReservationRow";
import { RestaurantGate } from "@/components/RestaurantGate";
import { AppMenu } from "@/components/AppMenu";
import { NewReservationDialog, type NewReservationInput } from "@/components/agenda/NewReservationDialog";
import { Plus, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SearchBox, ServiceNotes, VersionBadge } from "@/components/agenda/Extras";
import { ConnectionDot } from "@/components/ConnectionDot";
import { WhatsNew } from "@/components/ChangelogDialog";
import { TutorialAutoOpen } from "@/components/TutorialDialog";
import { APP_NAME } from "@/lib/extras";
import { AvailabilityPanel } from "@/components/agenda/AvailabilityPanel";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

export const Route = createFileRoute("/_authenticated/agenda")({
  validateSearch: (s: Record<string, unknown>): { d?: string; h?: string; c?: string; service?: boolean } => {
    const d = s["d"], h = s["h"], c = s["c"];
    return {
      ...(s["service"] === true || s["service"] === "true" ? { service: true } : {}),
      ...(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? { d } : {}),
      ...(typeof h === "string" && h ? { h } : {}),
      ...(typeof c === "string" && c ? { c } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Agenda — Segnatavolo" },
      { name: "description", content: "Agenda giornaliera di pranzo e sera." },
      { property: "og:title", content: "Agenda — Segnatavolo" },
      { property: "og:description", content: "Agenda giornaliera di pranzo e sera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RestaurantGate>
      <AgendaPage />
    </RestaurantGate>
  ),
});

function AgendaPage() {
  const restaurantId = useActiveRestaurantId();
  const search = Route.useSearch();
  const date = search.d ?? todayStr();
  const navigate = useNavigate({ from: "/agenda" });
  const qc = useQueryClient();
  const [newShift, setNewShift] = useState<Shift | null>(null);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ time: string; tables: string[] }>({ time: "", tables: [] });
  const [availShift, setAvailShift] = useState<Shift | null>(null);
  const [bookCustomer, setBookCustomer] = useState<string | undefined>(undefined);
  const openNew = (s: Shift, p: { time: string; tables: string[] } = { time: "", tables: [] }) => { setBookCustomer(undefined); setPrefill(p); setNewShift(s); };
  const { data: reservations = [] } = useReservations(date);
  const [onlyPending, setOnlyPending] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const settings = useSettings();
  const shifts = activeShifts(settings);
  useNewReservationNotifications();
  useEffect(() => {
    if (!search.c) return;
    const id = search.c;
    setPrefill({ time: "", tables: [] }); setBookCustomer(id); setNewShift(new Date().getHours() >= 16 ? "sera" : "pranzo");
    navigate({ search: ({ c: _c, ...p }) => p, replace: true });
  }, [search.c]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mobilePick, setMobileShift] = useState<Shift>(new Date().getHours() >= 16 ? "sera" : new Date().getHours() < 11 && settings.shifts.colazione.enabled ? "colazione" : "pranzo");
  const mobileShift: Shift = shifts.includes(mobilePick) ? mobilePick : (shifts[0] ?? "pranzo");
  const [month, setMonth] = useState<Date>(() => parseISO(date));
  const { data: rooms = [] } = useRooms();
  const { data: tables = [] } = useTables();
  const mFrom = format(startOfMonth(addDays(startOfMonth(month), -7)), "yyyy-MM-dd");
  const mTo = format(endOfMonth(addDays(endOfMonth(month), 7)), "yyyy-MM-dd");
  const { data: monthRows = [] } = useQuery(monthReservationsQuery(mFrom, mTo, restaurantId));
  const [calPick, setCalShift] = useState<Shift>("pranzo");
  const calShift: Shift = shifts.includes(calPick) ? calPick : (shifts[0] ?? "pranzo");
  const bookedByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of monthRows) if (!r.no_show) { const k = `${r.date}|${r.shift}|${r.outside ? "out" : "in"}`; m.set(k, (m.get(k) ?? 0) + r.people); }
    return m;
  }, [monthRows]);

  const setDate = (d: string) => navigate({ search: d === todayStr() ? {} : { d } });
  const goTo = (r: Reservation) => { setMobileShift(r.shift as Shift); navigate({ search: { ...(r.date === todayStr() ? {} : { d: r.date }), h: r.id } }); };
  const dateObj = parseISO(date);

  // Sfoglio con swipe: sinistra = avanti (turno successivo, poi giorno dopo), destra = indietro
  const [flipDir, setFlipDir] = useState<0 | 1 | -1>(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const flip = (dir: 1 | -1) => {
    const i = shifts.indexOf(mobileShift);
    setFlipDir(dir);
    if (dir === 1) {
      if (i < shifts.length - 1) setMobileShift(shifts[i + 1]!);
      else { setMobileShift(shifts[0]!); setDate(format(addDays(dateObj, 1), "yyyy-MM-dd")); }
    } else {
      if (i > 0) setMobileShift(shifts[i - 1]!);
      else { setMobileShift(shifts[shifts.length - 1]!); setDate(format(addDays(dateObj, -1), "yyyy-MM-dd")); }
    }
  };
  const onSwipeStart = (e: TouchEvent) => {
    const el = e.target as HTMLElement;
    // Niente sfoglio se c'è una finestra sovrapposta aperta (modali, drawer, tutorial) o se il tocco parte dalla mappa sala.
    if (document.querySelector('[data-slot="dialog-content"], [data-slot="sheet-content"], [role="dialog"], [role="alertdialog"]')) { touch.current = null; return; }
    touch.current = el.closest("input, textarea, select, [data-no-swipe]") ? null : { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
  };
  const onSwipeEnd = (e: TouchEvent) => {
    const t = touch.current; touch.current = null;
    if (!t || !shifts.length) return;
    const dx = e.changedTouches[0]!.clientX - t.x, dy = e.changedTouches[0]!.clientY - t.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) flip(dx < 0 ? 1 : -1);
  };

  const visible = reservations.filter((r) => !hidden.has(r.id));
  const byShift = (s: Shift) =>
    visible.filter((r) => r.shift === s).sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || a.created_at.localeCompare(b.created_at));

  const key = ["reservations", date, restaurantId];
  useEffect(() => { setMonth(parseISO(date)); }, [date]);

  const update = async (id: string, patch: Partial<Reservation>) => {
    void qc.cancelQueries({ queryKey: key });
    qc.setQueryData<Reservation[]>(key, (old) => old?.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("reservations").update(patch).eq("id", id).eq("restaurant_id", restaurantId ?? "");
    if (error) {
      toast.error("Salvataggio non riuscito");
      qc.invalidateQueries({ queryKey: key });
    }
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["customer-history"] });
    qc.invalidateQueries({ queryKey: ["search"] });
    qc.invalidateQueries({ queryKey: ["reservations-month"] });
  };

  const remove = async (r: Reservation) => {
    setHidden((h) => new Set(h).add(r.id));
    const deletion = Promise.resolve(supabase.from("reservations").update({ deleted_at: new Date().toISOString() }).eq("id", r.id).eq("restaurant_id", restaurantId ?? "").select("id").single());
    const undo = async (withoutTables = false) => {
      try {
        const result = await deletion; if (result.error) return;
        const restored = await restoreReservation(r.id, withoutTables);
        if (!restored) {
          toast.warning("Il tavolo originario è ora occupato. Ripristinare senza tavolo assegnato?", { duration: 15000, action: { label: "Senza tavolo", onClick: () => { void undo(true); } } });
          return;
        }
        setHidden((h) => { const n = new Set(h); n.delete(r.id); return n; });
        await refreshService(qc); toast.success("Prenotazione ripristinata");
      } catch { toast.error("Ripristino non riuscito: usa il Cestino del giorno"); }
    };
    const toastId = toast(`🗑️ Prenotazione di ${r.name || "—"} eliminata`, {
      duration: UNDO_DURATION,
      className: "border-2 border-destructive bg-paper text-foreground",
      action: {
        label: "ANNULLA",
        onClick: () => { void undo(); },
      },
    });
    const { error } = await deletion;
    if (error) { toast.dismiss(toastId); toast.error("Eliminazione non riuscita: prenotazione conservata"); }
    await refreshService(qc);
    setHidden((h) => { const n = new Set(h); n.delete(r.id); return n; });
  };

  const saveCustomerPhone = async (r: Reservation, phone: string) => {
    if (r.customer_id) {
      await supabase.from("customers").update({ phone }).eq("id", r.customer_id).eq("restaurant_id", restaurantId ?? "");
      qc.invalidateQueries({ queryKey: ["customers"] });
    }
  };

  const create = async (v: NewReservationInput): Promise<boolean> => {
    let customerId = v.customer?.id ?? null;
    const assist = restaurantId;
    if (!customerId) {
      const { data } = await supabase.from("customers").insert({ name: v.name, phone: v.phone || null, ...(assist ? { restaurant_id: assist } : {}) }).select("id").single();
      customerId = data?.id ?? null;
      qc.invalidateQueries({ queryKey: ["customers"] });
    }
    const { error } = await supabase.from("reservations").insert({
      date: v.date, shift: v.shift, time: v.time, name: v.name, people: v.people, phone: v.phone || null,
      is_new: v.is_new, outside: v.outside, notes: v.notes, customer_id: customerId, table_ids: v.table_ids, ...v.extras,
      duration_min: v.duration_min ?? null, buffer_min: v.buffer_min ?? null, tags: v.tags ?? [],
      ...(assist ? { restaurant_id: assist } : {}),
    });
    if (error) { toast.error("Impossibile salvare la prenotazione"); return false; }
    toast.success("Prenotazione salvata");
    qc.invalidateQueries({ queryKey: ["reservations", v.date] });
    qc.invalidateQueries({ queryKey: ["customer-history"] });
    if (v.date !== date) setDate(v.date);
    return true;
  };

  const dayExtra = (d: Date) => {
                  const ds = format(d, "yyyy-MM-dd");
                  if (isDayClosed(ds, settings)) return <span className="text-[8px] font-bold uppercase leading-none">Chiuso</span>;
                  const part = closedShifts(ds, settings).filter((s) => shifts.includes(s));
                  const cap = zoneCapacities(ds, calShift, rooms, tables, settings);
                  const bin = bookedByDay.get(`${ds}|${calShift}|in`) ?? 0;
                  const bout = bookedByDay.get(`${ds}|${calShift}|out`) ?? 0;
                  const tip = zoneTip(bin, cap.inside, bout, cap.outside);
                  return (
                    <span className="flex flex-col items-center gap-0.5">
                      <span title={tip} aria-label={tip} role="img" onClick={(e) => { if (window.matchMedia("(hover: none)").matches) { e.stopPropagation(); toast(tip, { duration: 3000 }); } }}
                        className="inline-flex items-center gap-0.5">
                        <span className={cn("inline-flex size-2 shrink-0 rounded-full", AFF_CLASS[affluenceLevel(bin, cap.inside)])} />
                        <span className={cn("inline-flex size-2 shrink-0 rounded-full", AFF_CLASS[affluenceLevel(bout, cap.outside)])} />
                      </span>
                      {part.length > 0 && <span className="text-[7px] leading-none text-muted-foreground">Chiuso {part.map((s) => shiftName(s)[0]).join("/")}</span>}
                    </span>
                  );
  };

  const move = async (r: Reservation, v: { date: string; shift: Shift; time: string }) => {
    qc.setQueryData<Reservation[]>(key, (old) => old?.filter((x) => x.id !== r.id));
    const { error } = await supabase.from("reservations").update({ ...v, no_show: false, arrived: false, table_ids: [], extra_sponde: 0, extra_barelle: 0 }).eq("id", r.id).eq("restaurant_id", restaurantId ?? "");
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["reservations", v.date] });
    qc.invalidateQueries({ queryKey: ["reservations-month"] });
    if (error) { toast.error("Spostamento non riuscito"); return; }
    qc.invalidateQueries({ queryKey: ["customer-history"] });
    toast.success(`Prenotazione spostata al ${format(parseISO(v.date), "d MMMM", { locale: it })} · ${shiftName(v.shift)} ${v.time}. Tavolo da assegnare.`, {
      action: { label: "Vai", onClick: () => setDate(v.date) },
    });
  };

  const duplicate = async (r: Reservation, v: { dates: string[]; shift: Shift; time: string }) => {
    const assist = restaurantId;
    const rows = v.dates.map((d) => ({
      date: d, shift: v.shift, time: v.time, name: r.name, people: r.people, phone: r.phone,
      is_new: false, outside: r.outside, notes: r.notes, customer_id: r.customer_id, table_ids: [] as string[],
      ...(assist ? { restaurant_id: assist } : {}),
    }));
    const { error } = await supabase.from("reservations").insert(rows);
    if (error) { toast.error("Duplicazione non riuscita"); return false; }
    for (const d of v.dates) qc.invalidateQueries({ queryKey: ["reservations", d] });
    qc.invalidateQueries({ queryKey: ["reservations-month"] });
    const n = v.dates.length;
    toast.success(`Prenotazione duplicata con successo su ${n} ${n === 1 ? "data" : "date"}`);
    return true;
  };

  const closedToday = closedShifts(date, settings);
  const renderPage = (shift: Shift, side: "left" | "right" | "mid") => {
    const all = byShift(shift);
    const c = shiftCounters(all);
    const rows = onlyPending ? all.filter((r) => !r.arrived) : all;
    const closed = closedToday.includes(shift);
    return (
      <section
        className={cn(
          "paper-page min-w-0 min-h-[70vh] flex-1 py-5 pl-12 pr-3 sm:pr-5",
          side === "left" ? "agenda-wide:rounded-l-md spine-left" : side === "right" ? "agenda-wide:rounded-r-md spine-right" : "",
          closed && "opacity-70",
        )}
      >
        <header className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 border-b-2 border-primary/60 pb-2">
          <h2 className="min-w-0 font-display text-3xl text-primary agenda-wide:text-2xl">{shiftName(shift).toUpperCase()}<span className="hidden agenda-wide:inline"> — {format(dateObj, "d MMMM", { locale: it })}</span></h2>
          {closed && <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-bold uppercase text-muted-foreground">Chiuso</span>}
          <div className="col-span-2 grid grid-cols-4 gap-2 text-right text-xs leading-tight">
            <Counter label="Coperti" value={c.total} strong />
            <Counter label="Interni" value={c.inside} />
            <Counter label="Fuori" value={c.outside} />
            <Counter label="Da arrivare" value={c.pending} accent />
          </div>
        </header>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={onlyPending} onCheckedChange={setOnlyPending} /> Mostra solo da arrivare</label>
        </div>
        <ServiceNotes date={date} shift={shift} />
        <div className={cn(ROW_GRID, "pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground")}>
          <span title="Arrivato" className="text-center">✓</span>
          <span>Ora</span>
          <span>Nome</span>
          <span className="text-center">Pers.</span>
          <span>Zona</span>
          <span />
        </div>
        {rows.map((r) => (
          <ReservationRow
            key={r.id}
            r={r}
            others={all}
            highlight={search.h === r.id}
            onUpdate={(p) => update(r.id, p)}
            onDelete={() => remove(r)}
            onCustomerPhone={(ph) => saveCustomerPhone(r, ph)}
            onMove={(v) => move(r, v)}
            onDuplicate={(v) => duplicate(r, v)}
            dayExtra={dayExtra}
          />
        ))}
        {rows.length === 0 && <p className="ruled-row py-4 font-hand text-lg text-muted-foreground">{all.length ? "Tutti arrivati" : "Nessuna prenotazione"}</p>}
      </section>
    );
  };

  return (
    <div className="min-h-screen pb-10">
      <div className="sticky top-0 z-30 border-b border-primary-foreground/10 bg-desk/95 px-3 py-2 text-primary-foreground backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 agenda-wide:grid-cols-[auto_auto_minmax(0,1fr)_auto]">
          <Button size="sm" variant="secondary" className="col-start-1 row-start-1 shrink-0" onClick={() => setDate(todayStr())}>Oggi</Button>
          <SearchBox onPick={goTo} className="col-start-2 row-start-1 agenda-wide:col-start-3 agenda-wide:justify-self-stretch" />
          <div className="col-start-3 row-start-1 shrink-0 agenda-wide:col-start-4">
            <AppMenu triggerClassName="hover:bg-primary-foreground/10 hover:text-primary-foreground" />
          </div>
          <div className="col-span-3 col-start-1 row-start-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 agenda-wide:col-span-1 agenda-wide:col-start-2 agenda-wide:row-start-1">
            <Button size="icon" variant="ghost" className="hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setDate(format(addDays(dateObj, -1), "yyyy-MM-dd"))} aria-label="Giorno precedente">
              <ChevronLeft />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" aria-label="Apri calendario" className="h-auto min-w-0 gap-2 whitespace-normal px-1 py-2 font-display text-xl capitalize leading-tight hover:bg-primary-foreground/10 hover:text-primary-foreground agenda-wide:text-lg">
                  <CalendarIcon className="hidden size-4 shrink-0 agenda-wide:block" />
                  <span className="min-w-0">{format(dateObj, "EEEE d MMMM yyyy", { locale: it })}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="border-b p-3 pb-2">
                  <div className="grid gap-1 rounded-md bg-muted p-1" style={{ gridTemplateColumns: `repeat(${Math.max(shifts.length, 1)}, minmax(0, 1fr))` }}>
                    {shifts.map((s) => (
                      <button key={s} type="button" onClick={() => setCalShift(s)}
                        className={cn("rounded px-3 py-2 text-sm font-semibold", calShift === s ? "bg-paper text-primary shadow-sm" : "text-muted-foreground")}>
                        {shiftEmoji(s)} {shiftName(s)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-center font-display text-lg text-primary">{shiftPlural(calShift)} di {format(month, "MMMM yyyy", { locale: it }).replace(/^\w/, (c) => c.toUpperCase())}</div>
                </div>
                <CalendarDayExtra.Provider value={dayExtra}>
                  <Calendar mode="single" modifiers={{ closed: (d: Date) => isDayClosed(format(d, "yyyy-MM-dd"), settings) }} modifiersClassNames={{ closed: "bg-muted/70 opacity-50 rounded-md" }} locale={it} selected={dateObj} month={month} onMonthChange={setMonth} onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))} className="pointer-events-auto p-3" />
                </CalendarDayExtra.Provider>
                <div className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2 text-[11px] text-muted-foreground">
                  <span><Dot level="green" /> libero</span><span><Dot level="yellow" /> limitato</span><span><Dot level="red" /> quasi pieno</span><span><Dot level="off" /> chiuso</span>
                </div>
              </PopoverContent>
            </Popover>
            <Button size="icon" variant="ghost" className="hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setDate(format(addDays(dateObj, 1), "yyyy-MM-dd"))} aria-label="Giorno successivo">
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="mx-auto mt-2 flex max-w-7xl flex-wrap items-center gap-2">
          <Button className="min-w-0 flex-1 whitespace-normal px-2 agenda-wide:flex-none" disabled={!shifts.length} onClick={() => openNew(mobileShift)}><Plus /> Nuova Prenotazione</Button>
          <Button variant="secondary" className="min-w-0 flex-1 whitespace-normal px-2 agenda-wide:flex-none" disabled={!shifts.length} onClick={() => setWalkinOpen(true)}><Zap /> Accomoda al volo</Button>
          <ServiceHub requestedOpen={search.service} onRequestedClose={() => navigate({ search: ({ service: _service, ...rest }) => rest, replace: true })} date={date} shifts={shifts} selectedShift={mobileShift} onAvailability={setAvailShift} />
        </div>
        <div style={{ gridTemplateColumns: `repeat(${Math.max(shifts.length, 1)}, minmax(0, 1fr))` }} className="mx-auto mt-2 grid max-w-7xl gap-1 rounded-md bg-primary-foreground/10 p-1 agenda-wide:hidden">
          {shifts.map((s) => (
            <Button
              variant="ghost"
              key={s}
              onClick={() => { setFlipDir(shifts.indexOf(s) > shifts.indexOf(mobileShift) ? 1 : shifts.indexOf(s) < shifts.indexOf(mobileShift) ? -1 : 0); setMobileShift(s); }}
              className={cn("rounded py-1.5 font-semibold", mobileShift === s ? "bg-paper text-primary" : "text-primary-foreground")}
            >
              {shiftEmoji(s)} {shiftName(s)}
            </Button>
          ))}
        </div>
      </div>

      <main className="mx-auto mt-4 max-w-7xl px-2 sm:px-4">
        <OnlineRequests />
        <div className="hidden gap-0 agenda-wide:flex">
          {shifts.map((s, i) => (
            <div key={s} className="flex min-w-0 flex-1 gap-0">
              {i > 0 && <div className="w-1 bg-desk" />}
              {renderPage(s, shifts.length === 1 ? "left" : i === 0 ? "left" : i === shifts.length - 1 ? "right" : "mid")}
            </div>
          ))}
          {shifts.length === 0 && <p className="text-primary-foreground">Nessun turno attivo: attivali in Gestione Ristorante.</p>}
        </div>
        <div className="overflow-hidden agenda-wide:hidden" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
          <div key={`${date}-${mobileShift}`} className={flipDir === 1 ? "animate-page-next" : flipDir === -1 ? "animate-page-prev" : undefined}>
            {shifts.length > 0 && renderPage(mobileShift, "left")}
          </div>
        </div>
      </main>
      <WhatsNew />
      <TutorialAutoOpen />
      <footer className="mt-6 flex items-center justify-center gap-2 text-xs text-primary-foreground/70">{APP_NAME} <VersionBadge /> <ConnectionDot /></footer>
      <NewReservationDialog open={!!newShift} onOpenChange={(o) => !o && setNewShift(null)} initialDate={date} initialShift={newShift ?? mobileShift} onCreate={create} initialTime={prefill.time} initialTables={prefill.tables} initialCustomerId={bookCustomer} />
      <WalkInDialog open={walkinOpen} onOpenChange={setWalkinOpen} onSaved={(d, s) => { setMobileShift(s); setDate(d); }} />
      <AvailabilityPanel open={!!availShift} onOpenChange={(o) => !o && setAvailShift(null)} date={date} shift={availShift ?? mobileShift}
        rows={availShift ? byShift(availShift) : []} onPick={(time, tableId) => { const s = availShift ?? mobileShift; setAvailShift(null); openNew(s, { time, tables: [tableId] }); }} />
    </div>
  );
}

function Counter({ label, value, strong, accent }: { label: string; value: number; strong?: boolean; accent?: boolean }) {
  return (
    <div>
      <div className={cn("font-display text-xl", strong && "text-2xl", accent && "text-primary")}>{value}</div>
      <div className="uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

const DOT_CLASS: Record<DotLevel, string> = {
  white: "bg-paper border border-muted-foreground/50",
  green: "bg-free",
  yellow: "bg-warning",
  red: "bg-destructive",
  black: "bg-foreground",
  off: "bg-muted opacity-40",
};

function Dot({ level }: { level: DotLevel }) {
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", DOT_CLASS[level])} />;
}

const AFF_CLASS: Record<Affluence, string> = {
  green: "bg-free",
  yellow: "bg-warning",
  red: "bg-destructive",
  closed: "bg-foreground/70",
};
