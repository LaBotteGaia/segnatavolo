import { useSettings } from "@/lib/membership";
import { maskPhone } from "@/lib/privacy";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RestaurantGate } from "@/components/RestaurantGate";
import { compareTables, extrasText, shiftCounters, shiftName, tableLabel, useReservations, useRooms, useTables, type Shift } from "@/lib/data";
import { useServiceNote, APP_NAME } from "@/lib/extras";

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
  const rows = res.filter((r) => r.shift === s).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const c = shiftCounters(rows);
  const cmp = compareTables(rooms);
  const firstTable = (ids: string[]) => (tables ?? []).filter((t) => ids.includes(t.id)).sort(cmp)[0];
  const groups = [
    ...(rooms ?? []).map((room) => ({
      key: room.id, title: room.name,
      rows: rows.filter((r) => firstTable(r.table_ids)?.room_id === room.id)
        .sort((a, b) => cmp(firstTable(a.table_ids)!, firstTable(b.table_ids)!) || (a.time || "99").localeCompare(b.time || "99")),
    })),
    { key: "none", title: "Tavolo da assegnare", rows: rows.filter((r) => !firstTable(r.table_ids)) },
  ].filter((g) => g.rows.length);
  return (
    <div className="min-h-screen bg-background p-4 text-foreground print:p-0">
      <div className="mb-4 flex gap-2 print:hidden">
        <Button asChild variant="secondary"><Link to="/agenda" search={{ d }}><ArrowLeft /> Torna all'agenda</Link></Button>
        <Button onClick={() => window.print()}><Printer /> Stampa / PDF</Button>
      </div>
      <div className="mx-auto max-w-4xl bg-card p-6 print:max-w-none print:p-0">
        <h1 className="font-display text-3xl">{shiftName(s).toUpperCase()} — {format(parseISO(d), "d MMMM", { locale: it })}</h1>
        <p className="mb-1 text-lg capitalize">{format(parseISO(d), "EEEE d MMMM yyyy", { locale: it })}</p>
        <p className="mb-3 font-semibold">Totale coperti: {c.total} (Interni {c.inside} · Fuori {c.outside})</p>
        {note && <p className="mb-3 rounded border p-2"><b>Note di servizio:</b> {note}</p>}
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b-2 text-left">
            <th className="p-1.5">Orario</th><th className="p-1.5">Tavolo</th><th className="p-1.5">Nome</th><th className="p-1.5">Coperti</th><th className="p-1.5">Richieste particolari / Intolleranze</th>
          </tr></thead>
          <tbody>
            {groups.map((g) => [
              <tr key={g.key} className="border-b bg-muted/50"><td colSpan={5} className="p-1.5 font-display text-base font-bold">{g.title}</td></tr>,
              ...g.rows.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="p-1.5 tabular-nums">{r.time}</td>
                <td className="p-1.5">{r.table_ids.length ? tableLabel(r.table_ids, tables, rooms) + extrasText(r) : "—"}</td>
                <td className="p-1.5">{r.name}{r.outside ? " (Fuori)" : ""}{r.phone && <div className="text-xs tabular-nums">📞 {settings.printPhones ? r.phone : maskPhone(r.phone)}</div>}</td>
                <td className="p-1.5 font-bold">{r.people}</td>
                <td className={r.notes ? "bg-warning/30 p-1.5 font-bold" : "p-1.5"}>{r.notes}</td>
              </tr>
            ))])}
            {!rows.length && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Nessuna prenotazione</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
