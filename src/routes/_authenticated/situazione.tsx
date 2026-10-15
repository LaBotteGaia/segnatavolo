import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RestaurantGate } from "@/components/RestaurantGate";
import { shiftName, useReservations, type Shift } from "@/lib/data";
import { useMembership } from "@/lib/membership";
import { APP_NAME } from "@/lib/extras";
import { fmt, interval, toMin } from "@/lib/rotation";
import { useShiftAvailability } from "@/components/agenda/AvailabilityPanel";

export const Route = createFileRoute("/_authenticated/situazione")({
  validateSearch: (s: Record<string, unknown>): { d: string; s: Shift } => ({
    d: typeof s["d"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["d"]) ? s["d"] : format(new Date(), "yyyy-MM-dd"),
    s: s["s"] === "colazione" || s["s"] === "sera" ? s["s"] : "pranzo",
  }),
  head: () => ({
    meta: [
      { title: `Situazione Tavoli — ${APP_NAME}` },
      { name: "description", content: "Riepilogo stampabile dei tavoli liberi e occupati del turno." },
      { property: "og:title", content: `Situazione Tavoli — ${APP_NAME}` },
      { property: "og:description", content: "Riepilogo stampabile dei tavoli liberi e occupati del turno." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RestaurantGate><Situazione /></RestaurantGate>,
});

function Situazione() {
  const { d, s } = Route.useSearch();
  const { data: m } = useMembership();
  const { data: res = [] } = useReservations(d);
  const rows = res.filter((r) => r.shift === s);
  const { tables, av, ranges, cfg, seats, booked } = useShiftAvailability(d, s, rows);
  const start = Math.floor(toMin(ranges[s].from) / 30) * 30;
  const end = Math.ceil((toMin(ranges[s].to) + cfg.duration) / 30) * 30;
  const span = end - start;
  const pct = (x: number) => `${((Math.min(Math.max(x, start), end) - start) / span) * 100}%`;
  const ticks: number[] = [];
  for (let x = start; x <= end; x += 30) ticks.push(x);
  const free = Math.max(0, seats - booked);

  return (
    <div className="min-h-screen bg-background p-4 text-foreground print:bg-card print:p-0">
      <style>{"@page { size: A4; margin: 10mm; } @media print { body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>
      <div className="mb-4 flex gap-2 print:hidden">
        <Button asChild variant="outline"><Link to="/agenda" search={{ d }}><ArrowLeft /> Agenda</Link></Button>
        <Button onClick={() => window.print()}><Printer /> Stampa / PDF</Button>
      </div>
      <div className="mx-auto max-w-4xl bg-card p-6 text-sm text-foreground print:max-w-none print:p-0 print:text-[11px]">
        <header className="mb-3 border-b-2 border-foreground pb-2">
          <h1 className="font-display text-2xl font-bold">{m?.restaurants?.name ?? APP_NAME}</h1>
          <p className="text-base font-semibold capitalize">Situazione Tavoli · {shiftName(s).toUpperCase()} — {format(parseISO(d), "EEEE d MMMM yyyy", { locale: it })}</p>
          <p className="mt-1">Coperti: <b>Occupati {booked}</b> · <b>Liberi {free}</b> · <b>Totali {seats}</b></p>
        </header>

        <table className="mb-4 w-full border-collapse border border-foreground">
          <thead>
            <tr>
              {["Tavoli Liberi Tutto il Servizio", "Liberi 1° Turno (fino alle)", "Liberi 2° Turno (dalle)"].map((h) => (
                <th key={h} className="w-1/3 border border-foreground p-1.5 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="border border-foreground p-1.5">{av.free.map((t) => <div key={t.id}>{t.name} [{t.seats}p]</div>)}{!av.free.length && "—"}</td>
              <td className="border border-foreground p-1.5">{av.first.map(({ t, until }) => <div key={t.id}>{t.name} [{t.seats}p] → <b>{until}</b></div>)}{!av.first.length && "—"}</td>
              <td className="border border-foreground p-1.5">{av.second.map(({ t, from }) => <div key={t.id}>{t.name} [{t.seats}p] dalle <b>{from}</b></div>)}{!av.second.length && "—"}</td>
            </tr>
          </tbody>
        </table>
        {av.full.length > 0 && <p className="mb-3">Occupati tutto il servizio: {av.full.map((t) => `${t.name} [${t.seats}p]`).join(" · ")}</p>}

        <h2 className="mb-1 font-bold">Planning orario</h2>
        <div className="break-inside-avoid">
          <div className="relative ml-16 h-4 text-[9px]">
            {ticks.map((x) => <span key={x} className="absolute -translate-x-1/2" style={{ left: pct(x) }}>{x % 60 === 0 ? fmt(x) : "·"}</span>)}
          </div>
          {tables.map((t) => {
            const its = rows.filter((r) => !r.no_show && r.table_ids.includes(t.id)).map((r) => ({ r, i: interval(r, cfg) })).filter((x) => !isNaN(x.i.start));
            return (
              <div key={t.id} className="flex items-center border-b border-foreground/30">
                <span className="w-16 shrink-0 truncate text-[10px] font-semibold">{t.name} ({t.seats}p)</span>
                <div className="relative h-4 flex-1">
                  {ticks.map((x) => <span key={x} className="absolute inset-y-0 border-l border-foreground/20" style={{ left: pct(x) }} />)}
                  {its.map(({ r, i }) => (
                    <div key={r.id}>
                      <div className="absolute inset-y-0.5 overflow-hidden whitespace-nowrap bg-foreground px-0.5 text-[8px] leading-3 text-background"
                        style={{ left: pct(i.start), width: `calc(${pct(i.end)} - ${pct(i.start)})` }}>{r.name} {r.people}p</div>
                      {i.free > i.end && <div className="absolute inset-y-0.5 border border-dashed border-foreground" style={{ left: pct(i.end), width: `calc(${pct(i.free)} - ${pct(i.end)})` }} />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="mt-1 text-[9px]">Nero = prenotazione · tratteggio = riallestimento ({cfg.buffer} min) · bianco = libero</p>
        </div>
      </div>
    </div>
  );
}
