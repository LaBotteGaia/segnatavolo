import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { compareTables, rangesOf, shiftName, useRooms, useTables, type Reservation, type Shift } from "@/lib/data";
import { useSettings } from "@/lib/membership";
import { Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmt, interval, isRoomClosedFor, shiftAvailability, toMin } from "@/lib/rotation";

/** Dati condivisi tra pannello e stampa: tavoli delle sale aperte nel turno, disponibilità e scala della timeline. */
export function useShiftAvailability(date: string, shift: Shift, rows: Reservation[]) {
  const settings = useSettings();
  const { data: rooms = [] } = useRooms();
  const { data: allTables = [] } = useTables();
  const ranges = rangesOf(settings);
  const cfg = { duration: settings.duration, buffer: settings.buffer };
  const openRooms = rooms.filter((r) => !isRoomClosedFor(r, date, shift));
  const tables = allTables.filter((t) => openRooms.some((r) => r.id === t.room_id))
    .sort(compareTables(rooms));
  const av = shiftAvailability(tables, rows, shift, ranges, cfg);
  const busyIds = new Set(rows.filter((r) => !r.no_show).flatMap((r) => r.table_ids));
  const seats = tables.reduce((a, t) => a + t.seats, 0);
  const booked = rows.filter((r) => !r.no_show || r.arrived).reduce((a, r) => a + r.people, 0);
  return { rooms, openRooms, tables, av, ranges, cfg, busyIds, seats, booked };
}

/** Riepilogo disponibilità del turno: elenco testuale + timeline oraria. Toccando uno spazio libero si apre la nuova prenotazione. */
export function AvailabilityPanel({ open, onOpenChange, date, shift, rows, onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; date: string; shift: Shift; rows: Reservation[];
  onPick: (time: string, tableId: string) => void;
}) {
  const { rooms, openRooms, tables, av, ranges, cfg } = useShiftAvailability(date, shift, rows);
  const firstSlot = ranges[shift].from;

  // Timeline: dall'inizio turno a fine ultimo arrivo + durata standard
  const start = Math.floor(toMin(ranges[shift].from) / 30) * 30;
  const end = Math.ceil((toMin(ranges[shift].to) + cfg.duration) / 30) * 30;
  const span = end - start;
  const pct = (m: number) => `${((Math.min(Math.max(m, start), end) - start) / span) * 100}%`;
  const ticks: number[] = [];
  for (let m = start; m <= end; m += 30) ticks.push(m);
  const last = toMin(ranges[shift].to);

  const chip = (id: string, text: string, time: string) => (
    <button key={id} type="button" onClick={() => onPick(time, id)} className="rounded-full border bg-paper px-2 py-0.5 text-left text-xs font-semibold hover:bg-accent sm:text-sm">{text}</button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto bg-paper">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">📊 Situazione Tavoli · {shiftName(shift)}</DialogTitle>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Tocca un tavolo o uno spazio verde per creare una prenotazione già compilata.</p>
            <Button asChild size="sm" variant="outline"><Link to="/situazione" search={{ d: date, s: shift }}><Printer /> Stampa Situazione</Link></Button>
          </div>
        </DialogHeader>

        <section className="space-y-2">
          <Group title="🟢 Liberi tutto il turno" empty={!av.free.length}>
            {av.free.map((t) => chip(t.id, `${t.name} [${t.seats}p]`, firstSlot))}
          </Group>
          <Group title="🟡 Liberi al 1° turno (fino alle…)" empty={!av.first.length}>
            {av.first.map(({ t, until }) => chip(t.id, `${t.name} [${t.seats}p] → ${until}`, firstSlot))}
          </Group>
          <Group title="🔵 Liberi al 2° turno (dalle…)" empty={!av.second.length}>
            {av.second.map(({ t, from }) => chip(t.id, `${t.name} [${t.seats}p] ${from} →`, from))}
          </Group>
          <Group title="🔴 Occupati" empty={!av.full.length}>
            {av.full.map((t) => <span key={t.id} className="rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:text-sm">{t.name} [{t.seats}p]</span>)}
          </Group>
          {rooms.length > openRooms.length && (
            <p className="text-xs text-muted-foreground">🚫 Sale chiuse in questo turno: {rooms.filter((r) => !openRooms.includes(r)).map((r) => r.name).join(", ")}</p>
          )}
        </section>

        <section className="mt-2">
          <h3 className="mb-2 font-display text-lg">Planning orario</h3>
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="relative ml-20 h-5 text-[10px] text-muted-foreground">
                {ticks.map((m) => <span key={m} className="absolute -translate-x-1/2" style={{ left: pct(m) }}>{m % 60 === 0 ? fmt(m) : "·"}</span>)}
              </div>
              {tables.map((t) => {
                const its = rows.filter((r) => !r.no_show && r.table_ids.includes(t.id)).map((r) => ({ r, i: interval(r, cfg) })).filter((x) => !isNaN(x.i.start)).sort((a, b) => a.i.start - b.i.start);
                // spazi liberi cliccabili a passi di 15'
                const slots: number[] = [];
                for (let m = toMin(ranges[shift].from); m <= last; m += 15) {
                  const stop = m + cfg.duration + cfg.buffer;
                  if (!its.some(({ i }) => m < i.free && i.start < stop)) slots.push(m);
                }
                return (
                  <div key={t.id} className="flex items-center border-b border-rule/60 py-0.5">
                    <span className="w-20 shrink-0 truncate pr-1 text-xs font-semibold">{t.name} <span className="text-muted-foreground">({t.seats}p)</span></span>
                    <div className="relative h-6 flex-1 rounded-sm bg-free/15 sm:h-8">
                      {ticks.map((m) => <span key={m} className="absolute inset-y-0 border-l border-rule/40" style={{ left: pct(m) }} />)}
                      {slots.map((m) => (
                        <button key={m} type="button" title={`Prenota ${t.name} alle ${fmt(m)}`} onClick={() => onPick(fmt(m), t.id)}
                          className="absolute inset-y-1 rounded-sm bg-free/35 hover:bg-free/70" style={{ left: pct(m), width: `${(15 / span) * 100}%` }} />
                      ))}
                      {its.map(({ r, i }) => (
                        <div key={r.id}>
                          <div className={cn("absolute inset-y-0.5 overflow-hidden whitespace-nowrap rounded-sm bg-primary px-1 text-[10px] leading-5 text-primary-foreground sm:leading-7", r.arrived && "opacity-60")}
                            style={{ left: pct(i.start), width: `calc(${pct(i.end)} - ${pct(i.start)})` }}>{r.name} · {r.people}p</div>
                          {i.free > i.end && (
                            <div className="absolute inset-y-0.5 rounded-sm border border-dashed border-muted-foreground/60 bg-muted"
                              style={{ left: pct(i.end), width: `calc(${pct(i.free)} - ${pct(i.end)})` }} title="Riallestimento" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!tables.length && <p className="text-sm text-muted-foreground">Nessun tavolo disponibile.</p>}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Barra piena = prenotazione · grigio tratteggiato = riallestimento ({cfg.buffer} min) · verde = spazio vendibile</p>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function Group({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-0.5 text-xs font-bold sm:text-sm">{title}</h4>
      <div className="flex flex-wrap gap-1">{empty ? <span className="text-sm text-muted-foreground">Nessuno</span> : children}</div>
    </div>
  );
}
