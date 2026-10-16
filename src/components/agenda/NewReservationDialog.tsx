import { useEffect, useState } from "react";
import { LoyaltyBox } from "./Extras";
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
import { supabase } from "@/integrations/supabase/client";
import {
  findCustomer, findCustomerByPhone, normPhone, reservationsQuery, tableLabel, extrasText, NO_EXTRAS, type TableExtras, timeSlots, useCustomers, useRooms, useTables,
  validateReservation, activeShifts, rangesOf, isShiftClosed, isDayClosed, shiftName, type Customer, type ReservationErrors, type Shift,
} from "@/lib/data";
import { TableDialog } from "./TableDialog";
import { useMembership, useSettings } from "@/lib/membership";
import { outsideClosed, DURATION_PRESETS, WHOLE_EVENING, durLabel } from "@/lib/rotation";
import { matchesSearch, phonesOf } from "@/lib/customers";
import { useCustomerHistory, useServiceClock } from "@/lib/extras";
import { reliabilityStats } from "@/lib/no-show";

export type NewReservationInput = {
  date: string; shift: Shift; time: string; name: string; people: number; phone: string;
  is_new: boolean; outside: boolean; notes: string; table_ids: string[]; extras: TableExtras; customer?: Customer | undefined;
  duration_min?: number | null; buffer_min?: number | null; tags?: string[];
};

const field = "w-full rounded-md border bg-paper px-3 py-2";
const bad = "border-destructive ring-1 ring-destructive";

export function NewReservationDialog({
  open, onOpenChange, initialDate, initialShift, onCreate, initialTime = "", initialTables = [], initialCustomerId,
}: {
  initialTime?: string; initialTables?: string[]; initialCustomerId?: string | undefined;
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
  const [extras, setExtras] = useState<TableExtras>(NO_EXTRAS);
  const [errors, setErrors] = useState<ReservationErrors>({});
  const [tableOpen, setTableOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(false);
  const [force, setForce] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [adv, setAdv] = useState(false);
  const [dur, setDur] = useState<number | null>(null);
  const [buf, setBuf] = useState<number | null>(null);
  const [tags, setTags] = useState("");
  const settings = useSettings();
  const { data: history = [] } = useCustomerHistory();
  const now = useServiceClock();
  const ranges = rangesOf(settings);
  const shifts = activeShifts(settings);
  const isMaster = useMembership().data?.role === "master";
  const closed = isShiftClosed(date, shift, settings);

  useEffect(() => {
    if (open) {
      setDate(initialDate); setShift(initialShift); setTime(initialTime); setName(""); setPeople("2");
      setPhone(""); setNotes(""); setOutside(false); setTableIds(initialTables); setExtras(NO_EXTRAS); setErrors({}); setForce(false); setPickedId(null);
      setAdv(false); setDur(null); setBuf(null); setTags("");
      const c = initialCustomerId ? customers?.find((x) => x.id === initialCustomerId) : undefined;
      if (c) { setName(c.name); setPickedId(c.id); setPhone(c.phone ?? ""); setNotes(c.notes ?? ""); }
    }
  }, [open, initialCustomerId, !!customers]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: dayRes = [] } = useQuery({ ...reservationsQuery(date), enabled: open });
  const others = dayRes.filter((r) => r.shift === shift);

  // Identità cliente = telefono. Il nome da solo aggancia solo se non ci sono omonimi.
  const byPhone = findCustomerByPhone(customers, phone) ?? (normPhone(phone).length >= 5 ? customers?.find((c) => phonesOf(c).includes(normPhone(phone))) : undefined);
  const picked = customers?.find((c) => c.id === pickedId);
  const sameName = (customers ?? []).filter((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const byName = sameName.length === 1 && !phone.trim() ? findCustomer(customers, name) : undefined;
  const match = byPhone ?? picked ?? byName;
  const isNew = name.trim().length > 0 && !match;
  const suggestions = name.trim() && !match
    ? (customers ?? []).filter((c) => matchesSearch(c, name)).slice(0, 8) : [];
  useEffect(() => { if (byPhone && !name.trim()) setName(byPhone.name); }, [byPhone?.id]);
  const fillNotes = (c?: Customer) => { if (c?.notes && !notes.trim()) setNotes(c.notes); };
  useEffect(() => { fillNotes(match); }, [match?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeShift = (s: Shift) => {
    setShift(s);
    if (!timeSlots(s, ranges).includes(time)) setTime("");
    setTableIds([]);
    setExtras(NO_EXTRAS);
  };

  const submit = async () => {
    const e = validateReservation({ name, people, date, time, shift }, ranges);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (closed && !(isMaster && force)) return;
    setBusy(true);
    const ok = await onCreate({
      date, shift, time, name: name.trim(), people: Number(people), phone: normPhone(match ? match.phone || phone : phone),
      is_new: isNew, outside, notes: notes.trim(), table_ids: tableIds, extras, customer: match,
      duration_min: dur, buffer_min: buf, tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const label = tableIds.length ? tableLabel(tableIds, tables, rooms) + extrasText(extras) : "";
  const err = (k: keyof ReservationErrors) => errors[k] && <p className="mt-1 text-sm text-destructive">{errors[k]}</p>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto bg-paper">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nuova prenotazione</DialogTitle>
        </DialogHeader>

        <div style={{ gridTemplateColumns: `repeat(${Math.max(shifts.length, 1)}, minmax(0, 1fr))` }} className="grid gap-1 rounded-md bg-muted p-1">
          {shifts.map((s) => (
            <button key={s} type="button" onClick={() => changeShift(s)}
              className={cn("rounded py-2 font-semibold", shift === s ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {shiftName(s)}
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
                  modifiers={{ closed: (d: Date) => isDayClosed(format(d, "yyyy-MM-dd"), settings) }} modifiersClassNames={{ closed: "bg-muted/70 opacity-50 rounded-md line-through" }}
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
                {timeSlots(shift, ranges).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {err("time")}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
          <div className="relative">
            <label className="text-xs font-semibold text-muted-foreground">Nome</label>
            <input value={name} onChange={(e) => { setName(e.target.value); setPickedId(null); }} onFocus={() => setFocus(true)}
              onBlur={() => setTimeout(() => setFocus(false), 150)} placeholder="Nome cliente"
              className={cn(field, "font-hand text-lg", errors.name && bad)} />
            {focus && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border bg-popover shadow-lg">
                {suggestions.map((c) => {
                  const stats = reliabilityStats(history, c.phone, ranges, now);
                  return (
                  <li key={c.id}>
                    <button type="button" onMouseDown={() => { setName(c.name); setPickedId(c.id); if (c.phone) setPhone(c.phone); fillNotes(c); }} className="w-full px-3 py-2 text-left hover:bg-accent">
                      <span className="font-hand text-lg">{c.name}</span>
                      <span className={cn("text-sm", stats.lastNoShow ? "text-destructive" : "text-muted-foreground")}> - {c.phone || "senza telefono"} (Ultima visita: {stats.last ? `${stats.lastNoShow ? "Mancata presentazione · " : ""}${format(parseISO(stats.last), "d MMM yyyy", { locale: it })}` : "mai"})</span>
                    </button>
                  </li>
                ); })}
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

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Telefono</label>
          <input value={phone} onChange={(e) => { setPhone(e.target.value); setPickedId(null); }} type="tel" placeholder="Numero di telefono" className={field} />
          {byPhone && <p className="mt-1 text-xs text-muted-foreground">Numero già in archivio: {byPhone.name}</p>}
          {(phone.trim() || match) && <div className="mt-2"><LoyaltyBox customerId={match?.id ?? null} phone={phone || match?.phone || null} /></div>}
        </div>

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

        <button type="button" onClick={() => setAdv(!adv)} className="text-left text-sm font-semibold text-muted-foreground hover:text-foreground">
          {adv ? "▴ Nascondi opzioni avanzate" : "⚙️ Mostra opzioni avanzate ▾"}
        </button>
        {adv && (
          <div className="space-y-3 rounded-md border border-dashed p-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Permanenza al tavolo</label>
              <div className="flex flex-wrap gap-1">
                {[...DURATION_PRESETS, WHOLE_EVENING].map((d) => (
                  <button key={d} type="button" onClick={() => setDur(dur === d ? null : d)}
                    className={cn("rounded-md border px-2 py-1 text-xs font-semibold", (dur ?? settings.duration) === d ? "bg-primary text-primary-foreground" : "bg-paper")}>
                    {d < 0 ? "Tutta la sera / No rotazione" : durLabel(d)}
                  </button>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs">Buffer pulizia
                <select value={buf ?? settings.buffer} onChange={(e) => setBuf(Number(e.target.value))} className="rounded-md border bg-paper px-2 py-1">
                  {[0, 5, 10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </label>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setTableOpen(true)}>+ Sponda / + Barella (dalla mappa tavoli)</Button>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Etichette (separate da virgola)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Compleanno, VIP…" className={field} />
            </div>
          </div>
        )}

        <div className="flex gap-6">
          <label className="flex items-center gap-2"><Checkbox checked={outside} onCheckedChange={(v) => setOutside(!!v)} /> Fuori</label>
          <label className="flex items-center gap-2"><Checkbox checked={isNew} disabled /> Nuovo cliente</label>
        </div>
        {outside && rooms && outsideClosed(rooms, date) && (
          <p className="rounded-md border border-warning bg-warning/20 p-2 text-sm font-semibold">❄️ Attenzione: in questa data le sale esterne sono chiuse per stagione o giorno di riposo.</p>
        )}

        {closed && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm">
            <p className="font-semibold text-destructive">Chiuso: il ristorante è chiuso a {shiftName(shift)} in questa data.</p>
            {isMaster ? (
              <label className="mt-2 flex items-center gap-2"><Checkbox checked={force} onCheckedChange={(v) => setForce(!!v)} /> Forza comunque la prenotazione (solo Master)</label>
            ) : (
              <p className="mt-1 text-muted-foreground">Scegli un'altra data o un altro turno.</p>
            )}
          </div>
        )}

        <Button size="lg" onClick={submit} disabled={busy || (closed && !(isMaster && force))}>Conferma prenotazione</Button>

        <TableDialog date={date} open={tableOpen} onOpenChange={setTableOpen}
          reservation={{ id: "new", name, people: Number(people) || 0, shift, table_ids: tableIds, time }}
          others={others} extras={extras} onConfirm={(ids, ex) => { setTableIds(ids); setExtras(ex); }} />
      </DialogContent>
    </Dialog>
  );
}
