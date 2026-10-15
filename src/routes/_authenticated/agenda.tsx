import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { activeShifts, closedShifts, dayDots, isDayClosed, monthReservationsQuery, shiftCounters, shiftEmoji, shiftName, totalCapacities, useReservations, useRooms, useTables, type DotLevel, type Reservation, type Shift } from "@/lib/data";
import { useSettings } from "@/lib/membership";
import { useNewReservationNotifications } from "@/lib/notifications";
import { ReservationRow, ROW_GRID } from "@/components/agenda/ReservationRow";
import { RestaurantGate } from "@/components/RestaurantGate";
import { AppMenu } from "@/components/AppMenu";
import { NewReservationDialog, type NewReservationInput } from "@/components/agenda/NewReservationDialog";
import { Plus, Printer } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SearchBox, ServiceNotes, VersionBadge } from "@/components/agenda/Extras";
import { WhatsNew } from "@/components/ChangelogDialog";
import { APP_NAME } from "@/lib/extras";
import { outsideClosed } from "@/lib/rotation";
import { AvailabilityPanel } from "@/components/agenda/AvailabilityPanel";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

export const Route = createFileRoute("/_authenticated/agenda")({
  validateSearch: (s: Record<string, unknown>): { d?: string; h?: string } => {
    const d = s["d"], h = s["h"];
    return {
      ...(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? { d } : {}),
      ...(typeof h === "string" && h ? { h } : {}),
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
  const search = Route.useSearch();
  const date = search.d ?? todayStr();
  const navigate = useNavigate({ from: "/agenda" });
  const qc = useQueryClient();
  const [newShift, setNewShift] = useState<Shift | null>(null);
  const [prefill, setPrefill] = useState<{ time: string; tables: string[] }>({ time: "", tables: [] });
  const [availShift, setAvailShift] = useState<Shift | null>(null);
  const openNew = (s: Shift, p: { time: string; tables: string[] } = { time: "", tables: [] }) => { setPrefill(p); setNewShift(s); };
  const { data: reservations = [] } = useReservations(date);
  const [onlyPending, setOnlyPending] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const settings = useSettings();
  const shifts = activeShifts(settings);
  useNewReservationNotifications();
  const [mobilePick, setMobileShift] = useState<Shift>(new Date().getHours() >= 16 ? "sera" : new Date().getHours() < 11 && settings.shifts.colazione.enabled ? "colazione" : "pranzo");
  const mobileShift: Shift = shifts.includes(mobilePick) ? mobilePick : (shifts[0] ?? "pranzo");
  const [month, setMonth] = useState<Date>(() => parseISO(date));
  const { data: rooms = [] } = useRooms();
  const { data: tables = [] } = useTables();
  const mFrom = format(startOfMonth(addDays(startOfMonth(month), -7)), "yyyy-MM-dd");
  const mTo = format(endOfMonth(addDays(endOfMonth(month), 7)), "yyyy-MM-dd");
  const { data: monthRows = [] } = useQuery(monthReservationsQuery(mFrom, mTo));
  const dotsByDay = useMemo(() => {
    const cap = totalCapacities(rooms, tables);
    const g = new Map<string, typeof monthRows>();
    for (const r of monthRows) g.set(r.date, [...(g.get(r.date) ?? []), r]);
    const out = new Map<string, ReturnType<typeof dayDots>>();
    for (const [d, rows] of g) { const dd = dayDots(rows, cap); out.set(d, outsideClosed(rooms, d) ? { ...dd, outside: "off" } : dd); }
    return out;
  }, [monthRows, rooms, tables]);
  const emptyDots = useMemo(() => dayDots([], totalCapacities(rooms, tables)), [rooms, tables]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const setDate = (d: string) => navigate({ search: d === todayStr() ? {} : { d } });
  const goTo = (r: Reservation) => { setMobileShift(r.shift as Shift); navigate({ search: { ...(r.date === todayStr() ? {} : { d: r.date }), h: r.id } }); };
  const dateObj = parseISO(date);

  const visible = reservations.filter((r) => !hidden.has(r.id));
  const byShift = (s: Shift) =>
    visible.filter((r) => r.shift === s).sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || a.created_at.localeCompare(b.created_at));

  const key = ["reservations", date];
  useEffect(() => { setMonth(parseISO(date)); }, [date]);

  const update = async (id: string, patch: Partial<Reservation>) => {
    qc.setQueryData<Reservation[]>(key, (old) => old?.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("reservations").update(patch).eq("id", id);
    if (error) {
      toast.error("Salvataggio non riuscito");
      qc.invalidateQueries({ queryKey: key });
    }
    qc.invalidateQueries({ queryKey: ["customer-history"] });
    qc.invalidateQueries({ queryKey: ["search"] });
  };

  const remove = (r: Reservation) => {
    setHidden((h) => new Set(h).add(r.id));
    const t = setTimeout(async () => {
      timers.current.delete(r.id);
      await supabase.from("reservations").delete().eq("id", r.id);
      await qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["customer-history"] });
      setHidden((h) => { const n = new Set(h); n.delete(r.id); return n; });
    }, 5000);
    timers.current.set(r.id, t);
    toast(`Prenotazione di ${r.name || "—"} eliminata`, {
      duration: 5000,
      action: {
        label: "Annulla",
        onClick: () => {
          clearTimeout(timers.current.get(r.id));
          timers.current.delete(r.id);
          setHidden((h) => { const n = new Set(h); n.delete(r.id); return n; });
        },
      },
    });
  };

  const saveCustomerPhone = async (r: Reservation, phone: string) => {
    if (r.customer_id) {
      await supabase.from("customers").update({ phone }).eq("id", r.customer_id);
      qc.invalidateQueries({ queryKey: ["customers"] });
    }
  };

  const create = async (v: NewReservationInput): Promise<boolean> => {
    let customerId = v.customer?.id ?? null;
    if (!customerId) {
      const { data } = await supabase.from("customers").insert({ name: v.name, phone: v.phone || null }).select("id").single();
      customerId = data?.id ?? null;
      qc.invalidateQueries({ queryKey: ["customers"] });
    }
    const { error } = await supabase.from("reservations").insert({
      date: v.date, shift: v.shift, time: v.time, name: v.name, people: v.people, phone: v.phone || null,
      is_new: v.is_new, outside: v.outside, notes: v.notes, customer_id: customerId, table_ids: v.table_ids, ...v.extras,
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
                  return (
                    <span className="flex flex-col items-center gap-0.5">
                      <DayDots dots={dotsByDay.get(ds) ?? (outsideClosed(rooms, ds) ? { ...emptyDots, outside: "off" as DotLevel } : emptyDots)} />
                      {part.length > 0 && <span className="text-[7px] leading-none text-muted-foreground">Chiuso {part.map((s) => shiftName(s)[0]).join("/")}</span>}
                    </span>
                  );
  };

  const move = async (r: Reservation, v: { date: string; shift: Shift; time: string }) => {
    qc.setQueryData<Reservation[]>(key, (old) => old?.filter((x) => x.id !== r.id));
    const { error } = await supabase.from("reservations").update({ ...v, table_ids: [], extra_sponde: 0, extra_barelle: 0 }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["reservations", v.date] });
    qc.invalidateQueries({ queryKey: ["reservations-month"] });
    if (error) { toast.error("Spostamento non riuscito"); return; }
    toast.success(`Prenotazione spostata al ${format(parseISO(v.date), "d MMMM", { locale: it })} · ${shiftName(v.shift)} ${v.time}. Tavolo da assegnare.`, {
      action: { label: "Vai", onClick: () => setDate(v.date) },
    });
  };

  const duplicate = async (r: Reservation, v: { dates: string[]; shift: Shift; time: string }) => {
    const rows = v.dates.map((d) => ({
      date: d, shift: v.shift, time: v.time, name: r.name, people: r.people, phone: r.phone,
      is_new: false, outside: r.outside, notes: r.notes, customer_id: r.customer_id, table_ids: [] as string[],
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
          <Button asChild size="sm" variant="outline"><Link to="/foglio" search={{ d: date, s: shift }}><Printer /> 🖨️ Foglio di Sala</Link></Button>
        </div>
        <ServiceNotes date={date} shift={shift} />
        <Button variant="outline" className="mb-2 w-full border-primary/50 font-semibold" onClick={() => setAvailShift(shift)}>📊 Situazione Tavoli / Disponibilità</Button>
        <Button className="mb-3 hidden w-full agenda-wide:flex" onClick={() => openNew(shift)}><Plus /> Nuova Prenotazione</Button>
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
                <CalendarDayExtra.Provider value={dayExtra}>
                  <Calendar mode="single" modifiers={{ closed: (d: Date) => isDayClosed(format(d, "yyyy-MM-dd"), settings) }} modifiersClassNames={{ closed: "bg-muted/70 opacity-50 rounded-md" }} locale={it} selected={dateObj} month={month} onMonthChange={setMonth} onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))} className="pointer-events-auto p-3" />
                </CalendarDayExtra.Provider>
                <div className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2 text-[11px] text-muted-foreground">
                  <span>Sx: interno · Dx: fuori</span>
                  <span><Dot level="green" /> libero</span><span><Dot level="yellow" /> limitato</span><span><Dot level="red" /> quasi pieno</span><span><Dot level="black" /> esaurito</span>
                </div>
              </PopoverContent>
            </Popover>
            <Button size="icon" variant="ghost" className="hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setDate(format(addDays(dateObj, 1), "yyyy-MM-dd"))} aria-label="Giorno successivo">
              <ChevronRight />
            </Button>
          </div>
        </div>
        <Button className="mx-auto mt-2 flex w-full max-w-7xl agenda-wide:hidden" onClick={() => openNew(mobileShift)}><Plus /> Nuova Prenotazione</Button>
        <div style={{ gridTemplateColumns: `repeat(${Math.max(shifts.length, 1)}, minmax(0, 1fr))` }} className="mx-auto mt-2 grid max-w-7xl gap-1 rounded-md bg-primary-foreground/10 p-1 agenda-wide:hidden">
          {shifts.map((s) => (
            <Button
              variant="ghost"
              key={s}
              onClick={() => setMobileShift(s)}
              className={cn("rounded py-1.5 font-semibold", mobileShift === s ? "bg-paper text-primary" : "text-primary-foreground")}
            >
              {shiftEmoji(s)} {shiftName(s)}
            </Button>
          ))}
        </div>
      </div>

      <main className="mx-auto mt-4 max-w-7xl px-2 sm:px-4">
        <div className="hidden gap-0 agenda-wide:flex">
          {shifts.map((s, i) => (
            <div key={s} className="flex min-w-0 flex-1 gap-0">
              {i > 0 && <div className="w-1 bg-desk" />}
              {renderPage(s, shifts.length === 1 ? "left" : i === 0 ? "left" : i === shifts.length - 1 ? "right" : "mid")}
            </div>
          ))}
          {shifts.length === 0 && <p className="text-primary-foreground">Nessun turno attivo: attivali in Gestione Ristorante.</p>}
        </div>
        <div className="agenda-wide:hidden">{shifts.length > 0 && renderPage(mobileShift, "left")}</div>
      </main>
      <WhatsNew />
      <footer className="mt-6 flex items-center justify-center gap-2 text-xs text-primary-foreground/70">{APP_NAME} <VersionBadge /></footer>
      <NewReservationDialog open={!!newShift} onOpenChange={(o) => !o && setNewShift(null)} initialDate={date} initialShift={newShift ?? mobileShift} onCreate={create} initialTime={prefill.time} initialTables={prefill.tables} />
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

function DayDots({ dots }: { dots: { inside: DotLevel; outside: DotLevel } }) {
  return (
    <span className="flex gap-0.5 !opacity-100" aria-hidden>
      <Dot level={dots.inside} />
      {dots.outside !== "off" && <Dot level={dots.outside} />}
    </span>
  );
}
