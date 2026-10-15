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
import { Plus } from "lucide-react";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

export const Route = createFileRoute("/_authenticated/agenda")({
  validateSearch: (s: Record<string, unknown>): { d?: string } => {
    const d = s["d"];
    return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? { d } : {};
  },
  head: () => ({
    meta: [
      { title: "Agenda — Prenotazioni" },
      { name: "description", content: "Agenda giornaliera di pranzo e sera." },
      { property: "og:title", content: "Agenda — Prenotazioni" },
      { property: "og:description", content: "Agenda giornaliera di pranzo e sera." },
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
  const { data: reservations = [] } = useReservations(date);
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
    for (const [d, rows] of g) out.set(d, dayDots(rows, cap));
    return out;
  }, [monthRows, rooms, tables]);
  const emptyDots = useMemo(() => dayDots([], totalCapacities(rooms, tables)), [rooms, tables]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const setDate = (d: string) => navigate({ search: d === todayStr() ? {} : { d } });
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
  };

  const remove = (r: Reservation) => {
    setHidden((h) => new Set(h).add(r.id));
    const t = setTimeout(async () => {
      timers.current.delete(r.id);
      await supabase.from("reservations").delete().eq("id", r.id);
      await qc.invalidateQueries({ queryKey: key });
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
      is_new: v.is_new, outside: v.outside, notes: v.notes, customer_id: customerId, table_ids: v.table_ids,
    });
    if (error) { toast.error("Impossibile salvare la prenotazione"); return false; }
    toast.success("Prenotazione salvata");
    qc.invalidateQueries({ queryKey: ["reservations", v.date] });
    if (v.date !== date) setDate(v.date);
    return true;
  };

  const closedToday = closedShifts(date, settings);
  const renderPage = (shift: Shift, side: "left" | "right" | "mid") => {
    const rows = byShift(shift);
    const c = shiftCounters(rows);
    const closed = closedToday.includes(shift);
    return (
      <section
        className={cn(
          "paper-page min-h-[70vh] flex-1 py-5 pl-12 pr-3 sm:pr-5",
          side === "left" ? "md:rounded-l-md spine-left" : side === "right" ? "md:rounded-r-md spine-right" : "",
          closed && "opacity-70",
        )}
      >
        <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b-2 border-primary/60 pb-2">
          <h2 className="font-display text-3xl tracking-wide text-primary">{shiftName(shift).toUpperCase()}</h2>
          {closed && <span className="rounded bg-muted px-2 py-0.5 text-xs font-bold uppercase text-muted-foreground">Chiuso</span>}
          <div className="flex gap-3 text-right text-xs leading-tight">
            <Counter label="Coperti" value={c.total} strong />
            <Counter label="Interni" value={c.inside} />
            <Counter label="Fuori" value={c.outside} />
            <Counter label="Da arrivare" value={c.pending} accent />
          </div>
        </header>
        <Button className="mb-3 hidden w-full md:flex" onClick={() => setNewShift(shift)}><Plus /> Nuova Prenotazione</Button>
        <div className={cn(ROW_GRID, "pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground")}>
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
            others={rows}
            onUpdate={(p) => update(r.id, p)}
            onDelete={() => remove(r)}
            onCustomerPhone={(ph) => saveCustomerPhone(r, ph)}
          />
        ))}
        {rows.length === 0 && <p className="ruled-row py-4 font-hand text-lg text-muted-foreground">Nessuna prenotazione</p>}
      </section>
    );
  };

  return (
    <div className="min-h-screen pb-10">
      <div className="sticky top-0 z-30 border-b border-primary-foreground/10 bg-desk/95 px-3 py-2 text-primary-foreground backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setDate(format(addDays(dateObj, -1), "yyyy-MM-dd"))} aria-label="Giorno precedente">
              <ChevronLeft />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1 font-display text-lg capitalize hover:bg-primary-foreground/10">
                  <CalendarIcon className="h-4 w-4" />
                  {format(dateObj, "EEEE d MMMM yyyy", { locale: it })}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarDayExtra.Provider value={(d) => {
                  const ds = format(d, "yyyy-MM-dd");
                  if (isDayClosed(ds, settings)) return <span className="text-[8px] font-bold uppercase leading-none">Chiuso</span>;
                  const part = closedShifts(ds, settings).filter((s) => shifts.includes(s));
                  return (
                    <span className="flex flex-col items-center gap-0.5">
                      <DayDots dots={dotsByDay.get(ds) ?? emptyDots} />
                      {part.length > 0 && <span className="text-[7px] leading-none text-muted-foreground">Chiuso {part.map((s) => shiftName(s)[0]).join("/")}</span>}
                    </span>
                  );
                }}>
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
            <Button size="sm" variant="secondary" onClick={() => setDate(todayStr())}>Oggi</Button>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <AppMenu triggerClassName="hover:bg-primary-foreground/10 hover:text-primary-foreground" />
          </div>
        </div>
        <Button className="mx-auto mt-2 flex w-full max-w-7xl md:hidden" onClick={() => setNewShift(mobileShift)}><Plus /> Nuova Prenotazione</Button>
        <div style={{ gridTemplateColumns: `repeat(${Math.max(shifts.length, 1)}, minmax(0, 1fr))` }} className="mx-auto mt-2 grid max-w-7xl gap-1 rounded-md bg-primary-foreground/10 p-1 md:hidden">
          {shifts.map((s) => (
            <button
              key={s}
              onClick={() => setMobileShift(s)}
              className={cn("rounded py-1.5 font-semibold", mobileShift === s ? "bg-paper text-primary" : "text-primary-foreground")}
            >
              {shiftEmoji(s)} {shiftName(s)}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto mt-4 max-w-7xl px-2 sm:px-4">
        <div className="hidden gap-0 md:flex">
          {shifts.map((s, i) => (
            <div key={s} className="flex flex-1 gap-0">
              {i > 0 && <div className="w-1 bg-desk" />}
              {renderPage(s, shifts.length === 1 ? "left" : i === 0 ? "left" : i === shifts.length - 1 ? "right" : "mid")}
            </div>
          ))}
          {shifts.length === 0 && <p className="text-primary-foreground">Nessun turno attivo: attivali in Gestione Ristorante.</p>}
        </div>
        <div className="md:hidden">{shifts.length > 0 && renderPage(mobileShift, "left")}</div>
      </main>
      <NewReservationDialog open={!!newShift} onOpenChange={(o) => !o && setNewShift(null)} initialDate={date} initialShift={newShift ?? mobileShift} onCreate={create} />
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
