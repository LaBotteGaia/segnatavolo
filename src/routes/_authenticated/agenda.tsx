import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight, LayoutGrid, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { shiftCounters, useReservations, type Reservation, type Shift } from "@/lib/data";
import { ReservationRow, ROW_GRID } from "@/components/agenda/ReservationRow";
import { NewReservationRow, type NewReservationInput } from "@/components/agenda/NewReservationRow";

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
  component: AgendaPage,
});

function AgendaPage() {
  const search = Route.useSearch();
  const date = search.d ?? todayStr();
  const navigate = useNavigate({ from: "/agenda" });
  const qc = useQueryClient();
  const { data: reservations = [] } = useReservations(date);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [mobileShift, setMobileShift] = useState<Shift>(new Date().getHours() >= 16 ? "sera" : "pranzo");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const setDate = (d: string) => navigate({ search: d === todayStr() ? {} : { d } });
  const dateObj = parseISO(date);

  const visible = reservations.filter((r) => !hidden.has(r.id));
  const byShift = (s: Shift) =>
    visible.filter((r) => r.shift === s).sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || a.created_at.localeCompare(b.created_at));

  const key = ["reservations", date];

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

  const create = async (shift: Shift, v: NewReservationInput) => {
    let customerId = v.customer?.id ?? null;
    if (!customerId) {
      const { data } = await supabase.from("customers").insert({ name: v.name, phone: v.phone || null }).select("id").single();
      customerId = data?.id ?? null;
      qc.invalidateQueries({ queryKey: ["customers"] });
    }
    const { error } = await supabase.from("reservations").insert({
      date, shift, time: v.time, name: v.name, people: v.people, phone: v.phone || null,
      is_new: v.is_new, outside: v.outside, notes: v.notes, customer_id: customerId,
    });
    if (error) toast.error("Impossibile salvare la prenotazione");
    qc.invalidateQueries({ queryKey: key });
  };

  const renderPage = (shift: Shift, side: "left" | "right") => {
    const rows = byShift(shift);
    const c = shiftCounters(rows);
    return (
      <section
        className={cn(
          "paper-page min-h-[70vh] flex-1 py-5 pl-12 pr-3 sm:pr-5",
          side === "left" ? "md:rounded-l-md spine-left" : "md:rounded-r-md spine-right",
        )}
      >
        <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b-2 border-primary/60 pb-2">
          <h2 className="font-display text-3xl tracking-wide text-primary">{shift === "pranzo" ? "PRANZO" : "SERA"}</h2>
          <div className="flex gap-3 text-right text-xs leading-tight">
            <Counter label="Coperti" value={c.total} strong />
            <Counter label="Interni" value={c.inside} />
            <Counter label="Fuori" value={c.outside} />
            <Counter label="Da arrivare" value={c.pending} accent />
          </div>
        </header>
        <div className={cn(ROW_GRID, "pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground")}>
          <span title="Arrivato">✓</span>
          <span>Ora</span>
          <span>Nome</span>
          <span className="text-center">Pers.</span>
          <span>Tavolo</span>
          <span className="hidden md:block">Richieste</span>
          <span className="hidden text-center md:block">Fuori</span>
          <span className="hidden text-center md:block">Nuovo</span>
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
        <NewReservationRow defaultTime={shift === "pranzo" ? "12:30" : "20:00"} onCreate={(v) => create(shift, v)} />
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
                <Calendar mode="single" locale={it} selected={dateObj} onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))} className="pointer-events-auto p-3" />
              </PopoverContent>
            </Popover>
            <Button size="icon" variant="ghost" className="hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setDate(format(addDays(dateObj, 1), "yyyy-MM-dd"))} aria-label="Giorno successivo">
              <ChevronRight />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDate(todayStr())}>Oggi</Button>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button asChild size="sm" variant="secondary">
              <Link to="/sale"><LayoutGrid /> Configura Sale</Link>
            </Button>
            <Button size="icon" variant="ghost" className="hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => supabase.auth.signOut()} aria-label="Esci">
              <LogOut />
            </Button>
          </div>
        </div>
        <div className="mx-auto mt-2 grid max-w-7xl grid-cols-2 gap-1 rounded-md bg-primary-foreground/10 p-1 md:hidden">
          {(["pranzo", "sera"] as Shift[]).map((s) => (
            <button
              key={s}
              onClick={() => setMobileShift(s)}
              className={cn("rounded py-1.5 font-semibold", mobileShift === s ? "bg-paper text-primary" : "text-primary-foreground")}
            >
              {s === "pranzo" ? "📖 Pranzo" : "🌙 Sera"}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto mt-4 max-w-7xl px-2 sm:px-4">
        <div className="hidden gap-0 md:flex">
          {renderPage("pranzo", "left")}
          <div className="w-1 bg-desk" />
          {renderPage("sera", "right")}
        </div>
        <div className="md:hidden">{renderPage(mobileShift, "left")}</div>
      </main>
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
