import { useEffect, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayExtra } from "@/components/ui/calendar";
import { activeShifts, isDayClosed, rangesOf, shiftName, timeSlots, type Reservation, type Shift } from "@/lib/data";
import { useSettings } from "@/lib/membership";
import { cn } from "@/lib/utils";

type DayExtra = ((d: Date) => ReactNode) | null;

function ShiftTime({ shift, time, onShift, onTime }: { shift: Shift; time: string; onShift: (s: Shift) => void; onTime: (t: string) => void }) {
  const settings = useSettings();
  const shifts = activeShifts(settings);
  const slots = timeSlots(shift, rangesOf(settings));
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="text-sm">Turno
        <select value={shift} onChange={(e) => { const s = e.target.value as Shift; onShift(s); const sl = timeSlots(s, rangesOf(settings)); if (!sl.includes(time)) onTime(sl[0] ?? ""); }}
          className="mt-1 w-full rounded-md border bg-paper px-3 py-2">
          {shifts.map((s) => <option key={s} value={s}>{shiftName(s)}</option>)}
        </select>
      </label>
      <label className="text-sm">Orario
        <select value={time} onChange={(e) => onTime(e.target.value)} className="mt-1 w-full rounded-md border bg-paper px-3 py-2 tabular-nums">
          {!slots.includes(time) && <option value={time}>{time || "--:--"}</option>}
          {slots.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
    </div>
  );
}

export function MoveDialog({ open, onOpenChange, r, dayExtra, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; r: Reservation; dayExtra: DayExtra;
  onConfirm: (v: { date: string; shift: Shift; time: string }) => void;
}) {
  const settings = useSettings();
  const [date, setDate] = useState<Date | undefined>();
  const [shift, setShift] = useState<Shift>(r.shift as Shift);
  const [time, setTime] = useState(r.time);
  useEffect(() => { if (open) { setDate(undefined); setShift(r.shift as Shift); setTime(r.time); } }, [open, r]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📅 Sposta data</DialogTitle>
          <DialogDescription>Prenotazione di {r.name || "—"}, {r.people}p.</DialogDescription>
        </DialogHeader>
        <CalendarDayExtra.Provider value={dayExtra}>
          <Calendar mode="single" locale={it} selected={date} onSelect={setDate} defaultMonth={parseISO(r.date)}
            disabled={(d) => isDayClosed(format(d, "yyyy-MM-dd"), settings)} className="pointer-events-auto mx-auto p-3" />
        </CalendarDayExtra.Provider>
        <ShiftTime shift={shift} time={time} onShift={setShift} onTime={setTime} />
        {r.table_ids.length > 0 && (
          <p className="rounded-md border border-warning bg-warning/15 px-3 py-2 text-sm">⚠️ Nella nuova data i tavoli possono essere occupati: il tavolo tornerà "Da assegnare".</p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button disabled={!date || !time} onClick={() => date && onConfirm({ date: format(date, "yyyy-MM-dd"), shift, time })}>
            {date ? `Sposta al ${format(date, "d MMM", { locale: it })}` : "Scegli una data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DuplicateDialog({ open, onOpenChange, r, dayExtra, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; r: Reservation; dayExtra: DayExtra;
  onConfirm: (v: { dates: string[]; shift: Shift; time: string }) => Promise<void>;
}) {
  const settings = useSettings();
  const [dates, setDates] = useState<Date[]>([]);
  const [shift, setShift] = useState<Shift>(r.shift as Shift);
  const [time, setTime] = useState(r.time);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setDates([]); setShift(r.shift as Shift); setTime(r.time); } }, [open, r]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📋 Duplica prenotazione</DialogTitle>
          <DialogDescription>Tocca una o più date. Nome, telefono, coperti, note e Dentro/Fuori vengono copiati; il tavolo resta "Da assegnare".</DialogDescription>
        </DialogHeader>
        <CalendarDayExtra.Provider value={dayExtra}>
          <Calendar mode="multiple" locale={it} selected={dates} onSelect={(d) => setDates(d ?? [])} defaultMonth={parseISO(r.date)}
            disabled={(d) => isDayClosed(format(d, "yyyy-MM-dd"), settings)} className="pointer-events-auto mx-auto p-3" />
        </CalendarDayExtra.Provider>
        <ShiftTime shift={shift} time={time} onShift={setShift} onTime={setTime} />
        <p className={cn("text-sm", dates.length ? "font-semibold text-primary" : "text-muted-foreground")}>
          {dates.length ? `${dates.length} ${dates.length === 1 ? "data selezionata" : "date selezionate"}` : "Nessuna data selezionata"}
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button disabled={!dates.length || !time || busy} onClick={async () => {
            setBusy(true);
            await onConfirm({ dates: dates.map((d) => format(d, "yyyy-MM-dd")).sort(), shift, time });
            setBusy(false);
          }}>Duplica</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
