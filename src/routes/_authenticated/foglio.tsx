import { useSettings } from "@/lib/membership";
import { maskPhone } from "@/lib/privacy";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RestaurantGate } from "@/components/RestaurantGate";
import { extrasText, shiftCounters, shiftName, tableLabel, useReservations, useRooms, useTables, type Shift } from "@/lib/data";
import { useServiceNote, APP_NAME } from "@/lib/extras";
import { chronologicalServiceRows } from "@/lib/service-sheet";

export const Route = createFileRoute("/_authenticated/foglio")({
  validateSearch: (s: Record<string, unknown>): { d: string; s: Shift } => ({
    d: typeof s["d"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["d"]) ? s["d"] : format(new Date(), "yyyy-MM-dd"),
    s: s["s"] === "colazione" || s["s"] === "sera" ? s["s"] : "pranzo",
  }),
  head: () => ({
    meta: [
      { title: `Foglio di Sala — ${APP_NAME}` },
      { name: "description", content: "Foglio di sala stampabile per servizio e cucina." },
      { property: "og:title", content: `Foglio di Sala — ${APP_NAME}` },
      { property: "og:description", content: "Foglio di sala stampabile per servizio e cucina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RestaurantGate><Foglio /></RestaurantGate>,
});

function Foglio() {
  const { d, s } = Route.useSearch();
  const { data: res = [] } = useReservations(d);
  const { data: rooms } = useRooms();
  const settings = useSettings();
  const { data: tables } = useTables();
  const { data: note } = useServiceNote(d, s);
  const rows = chronologicalServiceRows(res.filter((r) => r.shift === s));
  const c = shiftCounters(rows);
  return (
    <div className="service-sheet min-h-screen bg-background p-3 text-foreground sm:p-4 print:p-0">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Button asChild variant="secondary"><Link to="/agenda" search={{ d }}><ArrowLeft /> Torna all'agenda</Link></Button>
        <Button onClick={() => window.print()}><Printer /> Stampa / PDF</Button>
      </div>
      <div className="service-sheet-paper mx-auto max-w-4xl bg-card p-3 sm:p-6 print:max-w-none print:p-0">
        <table aria-label="Prenotazioni del servizio" className="service-sheet-table w-full table-fixed border-collapse text-sm">
          <colgroup><col className="w-[49%]" /><col className="w-[13%]" /><col className="w-[20%]" /><col className="w-[11%]" /><col className="w-[7%]" /></colgroup>
          <thead>
            <tr><td colSpan={5} className="pb-4 text-left">
              <h1 className="font-display text-2xl sm:text-3xl">{shiftName(s).toUpperCase()} — {format(parseISO(d), "d MMMM", { locale: it })}</h1>
              <p className="mb-1 text-base capitalize sm:text-lg">{format(parseISO(d), "EEEE d MMMM yyyy", { locale: it })}</p>
              <p className="font-semibold">Totale coperti: {c.total} (Interni {c.inside} · Fuori {c.outside})</p>
              {note && <p className="mt-2 whitespace-pre-line break-words text-sm"><b>Note di servizio:</b> {note}</p>}
            </td></tr>
            <tr className="border-b-2 text-left">
              <th scope="col" className="py-2 pr-2">Cliente e contatto</th><th scope="col" className="px-1 py-2 text-center">Orario</th><th scope="col" className="px-1 py-2 text-center">Tavolo</th><th scope="col" className="px-1 py-2 text-center">Coperti</th><th scope="col" className="py-2 text-center"><span className="sr-only">Arrivo</span>✓</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="py-3 pr-2">
                  <div className="break-words text-base font-bold">{r.name}{r.outside ? " (Fuori)" : ""}</div>
                  {r.phone && <div className="service-sheet-contact break-words text-sm tabular-nums text-muted-foreground">{settings.printPhones ? r.phone : maskPhone(r.phone)}</div>}
                  {r.notes && <div className="service-sheet-notes mt-1 whitespace-pre-line break-words border-l-2 border-warning pl-2 text-sm font-semibold">{r.notes}</div>}
                </td>
                <td className="px-1 py-3 text-center text-base tabular-nums">{r.time || "—"}</td>
                <td className="break-words px-1 py-3 text-center text-base font-bold">{r.table_ids.length ? tableLabel(r.table_ids, tables, rooms) + extrasText(r) : "Da assegnare"}</td>
                <td className="px-1 py-3 text-center text-base font-bold tabular-nums">{r.people}</td>
                <td className="py-3 text-center"><span aria-label="Spunta arrivo a penna" className="service-sheet-arrival mx-auto block size-4 border border-foreground" /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Nessuna prenotazione</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
