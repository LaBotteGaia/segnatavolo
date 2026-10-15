import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, MessageCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { tableLabel, whatsappLink, useRooms, useTables, type Reservation } from "@/lib/data";
import { TableDialog } from "./TableDialog";

export const ROW_GRID =
  "grid items-center gap-x-2 grid-cols-[1.75rem_3.2rem_minmax(0,1fr)_2.6rem_1.75rem] md:grid-cols-[1.75rem_3.5rem_minmax(0,1.3fr)_2.5rem_minmax(0,1.1fr)_minmax(0,1.4fr)_2.2rem_2.2rem_1.75rem]";

export function ReservationRow({
  r,
  others,
  onUpdate,
  onDelete,
  onCustomerPhone,
}: {
  r: Reservation;
  others: Reservation[];
  onUpdate: (patch: Partial<Reservation>) => void;
  onDelete: () => void;
  onCustomerPhone: (phone: string) => void;
}) {
  const { data: rooms } = useRooms();
  const { data: tables } = useTables();
  const [notes, setNotes] = useState(r.notes);
  const [time, setTime] = useState(r.time);
  const [phone, setPhone] = useState(r.phone ?? "");
  const [tableOpen, setTableOpen] = useState(false);
  const [people, setPeople] = useState(String(r.people));
  useEffect(() => setPeople(String(r.people)), [r.people]);
  useEffect(() => setNotes(r.notes), [r.notes]);
  useEffect(() => setTime(r.time), [r.time]);
  useEffect(() => setPhone(r.phone ?? ""), [r.phone]);

  const label = tableLabel(r.table_ids, tables, rooms);
  const dim = r.arrived && "opacity-50";

  const notesInput = (
    <input
      value={notes}
      placeholder="note…"
      onChange={(e) => setNotes(e.target.value)}
      onBlur={() => notes !== r.notes && onUpdate({ notes })}
      className="w-full min-w-0 bg-transparent font-hand text-base text-ink outline-none placeholder:text-muted-foreground/50"
    />
  );

  return (
    <div className="relative ruled-row py-1.5">
      <div className={ROW_GRID}>
        <Checkbox checked={r.arrived} onCheckedChange={(v) => onUpdate({ arrived: !!v })} aria-label="Arrivato" className="relative z-10" />
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => time !== r.time && onUpdate({ time })}
          className={cn("w-full bg-transparent font-display font-semibold tabular-nums outline-none", dim)}
          inputMode="numeric"
          placeholder="--:--"
        />
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn("truncate text-left font-hand text-lg text-ink hover:underline", dim)}>
              {r.name || "—"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3 bg-paper">
            <p className="font-display text-lg">{r.name}</p>
            <div>
              <label className="text-xs text-muted-foreground">Telefono</label>
              <Input
                value={phone}
                type="tel"
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => {
                  if (phone !== (r.phone ?? "")) {
                    onUpdate({ phone });
                    onCustomerPhone(phone);
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" disabled={!phone}>
                <a href={`tel:${phone}`}><Phone /> Chiama</a>
              </Button>
              <Button asChild variant="outline" disabled={!phone}>
                <a href={whatsappLink(phone, r)} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
              </Button>
            </div>
            <Button variant="destructive" className="w-full" onClick={onDelete}>
              <Trash2 /> Elimina prenotazione
            </Button>
          </PopoverContent>
        </Popover>
        <input
          type="number"
          min={1}
          value={people}
          onChange={(e) => setPeople(e.target.value)}
          onBlur={() => {
            const n = Number(people);
            if (Number.isInteger(n) && n >= 1) { if (n !== r.people) onUpdate({ people: n }); }
            else { toast.error("Inserisci almeno 1 persona"); setPeople(String(r.people)); }
          }}
          className={cn("w-full bg-transparent text-center font-display font-semibold outline-none", dim)}
        />
        <button
          onClick={() => setTableOpen(true)}
          className={cn(
            "relative z-10 hidden truncate rounded border md:block px-1.5 py-0.5 text-left text-xs font-semibold",
            label ? "border-primary/40 text-primary" : "border-dashed text-muted-foreground",
          )}
        >
          {label || "Assegna"}
        </button>
        <div className={cn("hidden md:block", dim)}>{notesInput}</div>
        <div className="hidden justify-center md:flex">
          <Checkbox checked={r.outside} onCheckedChange={(v) => onUpdate({ outside: !!v })} aria-label="Fuori" className="relative z-10" />
        </div>
        <div className="hidden justify-center md:flex">
          <Checkbox checked={r.is_new} onCheckedChange={(v) => onUpdate({ is_new: !!v })} aria-label="Nuovo" className="relative z-10" />
        </div>
        <button onClick={onDelete} aria-label="Elimina" className="relative z-10 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {/* mobile second line */}
      <button
        onClick={() => setTableOpen(true)}
        className={cn(
          "relative z-10 mt-1 ml-9 flex w-[calc(100%-2.25rem)] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-semibold md:hidden",
          label ? "border-primary/50 bg-primary/5 text-primary" : "border-dashed text-muted-foreground",
        )}
      >
        <span className="shrink-0">Tavolo:</span><span className="truncate">{label || "Assegna"}</span>
      </button>
      <div className={cn("mt-0.5 flex items-center gap-3 pl-9 md:hidden", dim)}>
        <div className="min-w-0 flex-1">{notesInput}</div>
        <label className="relative z-10 flex items-center gap-1 text-xs">
          <Checkbox checked={r.outside} onCheckedChange={(v) => onUpdate({ outside: !!v })} /> Fuori
        </label>
        <label className="relative z-10 flex items-center gap-1 text-xs">
          <Checkbox checked={r.is_new} onCheckedChange={(v) => onUpdate({ is_new: !!v })} /> Nuovo
        </label>
      </div>
      {r.arrived && <div className="strike-line" />}
      <TableDialog
        open={tableOpen}
        onOpenChange={setTableOpen}
        reservation={r}
        others={others}
        onConfirm={(ids) => onUpdate({ table_ids: ids })}
      />
    </div>
  );
}
