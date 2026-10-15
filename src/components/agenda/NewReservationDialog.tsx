import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, LayoutGrid } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  findCustomer, reservationsQuery, tableLabel, timeSlots, useCustomers, useRooms, useTables,
  validateReservation, type Customer, type ReservationErrors, type Shift,
} from "@/lib/data";
import { TableDialog } from "./TableDialog";

export type NewReservationInput = {
  date: string; shift: Shift; time: string; name: string; people: number; phone: string;
  is_new: boolean; outside: boolean; notes: string; table_ids: string[]; customer?: Customer;
};

const field = "w-full rounded-md border bg-paper px-3 py-2";
const bad = "border-destructive ring-1 ring-destructive";

export function NewReservationDialog({
  open, onOpenChange, initialDate, initialShift, onCreate,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; initialDate: string; initialShift: Shift;
  onCreate: (v: NewReservationInput) => Promise<boolean>;
}) {
  const { data: customers } = useCustomers();
  const { data: rooms } = useRooms();
  const { data: tables } = useTables();
  const [date, setDate] = useState(initialDate);
  const [shift, setShift] = useState<Shift>(initialShift);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [people, setPeople] = useState("2");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [outside, setOutside] = useState(false);
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<ReservationErrors>({});
  const [tableOpen, setTableOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(initialDate); setShift(initialShift); setTime(""); setName(""); setPeople("2");
      setPhone(""); setNotes(""); setOutside(false); setTableIds([]); setErrors({});
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: dayRes = [] } = useQuery({ ...reservationsQuery(date), enabled: open });
  const others = dayRes.filter((r) => r.shift === shift);

  const match = findCustomer(customers, name);
  const isNew = name.trim().length > 0 && !match;
  const suggestions = name.trim() && !match
    ? (customers ?? []).filter((c) => c.name.toLowerCase().includes(name.trim().toLowerCase())).slice(0, 6) : [];

  const changeShift = (s: Shift) => {
    setShift(s);
    if (!timeSlots(s).includes(time)) setTime("");
    setTableIds([]);
  };

  const submit = async () => {
    const e = validateReservation({ name, people, date, time, shift });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const ok = await onCreate({
      date, shift, time, name: name.trim(), people: Number(people), phone: match ? match.phone ?? "" : phone.trim(),
      is_new: isNew, outside, notes: notes.trim(), table_ids: tableIds, customer: match,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const label = tableLabel(tableIds, tables, rooms);
  const err = (k: keyof ReservationErrors) => errors[k] && <p className="mt-1 text-sm text-destructive">{errors[k]}</p>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto bg-paper">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nuova prenotazione</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {(["pranzo", "sera"] as Shift[]).map((s) => (
            <button key={s} type="button" onClick={() => changeShift(s)}
              className={cn("rounded py-2 font-semibold", shift === s ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {s === "pranzo" ? "Pranzo" : "Cena"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Data</label>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={cn(field, "flex items-center gap-2 text-left capitalize", errors.date && bad)}>
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{format(parseISO(date), "EEE d MMM yyyy", { locale: it })}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" locale={it} selected={parseISO(date)}
                  onSelect={(d) => { if (d) { setDate(format(d, "yyyy-MM-dd")); setTableIds([]); } }}
                  className="pointer-events-auto p-3" />
              </PopoverContent>
            </Popover>
            {err("date")}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Orario</label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger className={cn("h-[42px] bg-paper", errors.time && bad)}>
                <SelectValue placeholder="Scegli…" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots(shift).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {err("time")}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
          <div className="relative">
            <label className="text-xs font-semibold text-muted-foreground">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setFocus(true)}
              onBlur={() => setTimeout(() => setFocus(false), 150)} placeholder="Nome cliente"
              className={cn(field, "font-hand text-lg", errors.name && bad)} />
            {focus && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border bg-popover shadow-lg">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button type="button" onMouseDown={() => setName(c.name)} className="w-full px-3 py-2 text-left font-hand text-lg hover:bg-accent">{c.name}</button>
                  </li>
                ))}
              </ul>
            )}
            {err("name")}
            {match && <p className="mt-1 text-xs text-muted-foreground">Cliente già in archivio{match.notes ? ` · ${match.notes}` : ""}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Persone</label>
            <input value={people} inputMode="numeric" onChange={(e) => setPeople(e.target.value.replace(/\D/g, ""))}
              className={cn(field, "text-center font-display text-lg", errors.people && bad)} />
          </div>
          {errors.people && <p className="col-span-2 -mt-2 text-sm text-destructive">{errors.people}</p>}
        </div>

        {isNew && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Telefono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Numero di telefono" className={field} />
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Tavolo</label>
          <Button type="button" variant="outline" className="h-auto w-full justify-start py-3" onClick={() => setTableOpen(true)}>
            <LayoutGrid /> {label ? <span className="truncate font-semibold text-primary">{label}</span> : "Assegna tavolo sulla mappa"}
          </Button>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Richieste particolari</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergie, seggiolone…" className={cn(field, "font-hand")} />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2"><Checkbox checked={outside} onCheckedChange={(v) => setOutside(!!v)} /> Fuori</label>
          <label className="flex items-center gap-2"><Checkbox checked={isNew} disabled /> Nuovo cliente</label>
        </div>

        <Button size="lg" onClick={submit} disabled={busy}>Conferma prenotazione</Button>

        <TableDialog open={tableOpen} onOpenChange={setTableOpen}
          reservation={{ id: "new", name, people: Number(people) || 0, shift, table_ids: tableIds }}
          others={others} onConfirm={setTableIds} />
      </DialogContent>
    </Dialog>
  );
}
