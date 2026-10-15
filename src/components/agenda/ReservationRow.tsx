import { useEffect, useState, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ArrowLeft, CalendarDays, ChevronDown, Copy, LayoutGrid, MessageCircle, Phone, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  activeShifts, commitTimeCheck, firstName, mismatchText, rangesOf, tableLabel, whatsappLink, zoneMismatch,
  useRooms, useTables, type Reservation, type Shift,
} from "@/lib/data";
import { useSettings } from "@/lib/membership";
import { TableDialog } from "./TableDialog";
import { MoveDialog, DuplicateDialog } from "./MoveDuplicateDialogs";

export const ROW_GRID = "grid items-center gap-x-2 grid-cols-[3.4rem_minmax(0,1fr)_2.8rem_5.5rem_1.25rem]";

export function ReservationRow({
  r, others, onUpdate, onDelete, onCustomerPhone, onMove, onDuplicate, dayExtra = null,
}: {
  r: Reservation;
  others: Reservation[];
  onUpdate: (patch: Partial<Reservation>) => void;
  onDelete: () => void;
  onCustomerPhone: (phone: string) => void;
  onMove: (v: { date: string; shift: Shift; time: string }) => void;
  onDuplicate: (v: { dates: string[]; shift: Shift; time: string }) => Promise<boolean>;
  dayExtra?: ((d: Date) => ReactNode) | null;
}) {
  const { data: rooms } = useRooms();
  const { data: tables } = useTables();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(r.notes);
  const [time, setTime] = useState(r.time);
  const [phone, setPhone] = useState(r.phone ?? "");
  const [people, setPeople] = useState(String(r.people));
  const [tableOpen, setTableOpen] = useState(false);
  const [timeBad, setTimeBad] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { if (!open) setConfirmDel(false); }, [open]);
  useEffect(() => setPeople(String(r.people)), [r.people]);
  useEffect(() => setNotes(r.notes), [r.notes]);
  useEffect(() => setTime(r.time), [r.time]);
  useEffect(() => setPhone(r.phone ?? ""), [r.phone]);

  const label = tableLabel(r.table_ids, tables, rooms);
  const mismatch = zoneMismatch(r, tables, rooms);
  const dim = r.arrived && "opacity-50";

  const commitTime = () => {
    const res = commitTimeCheck(time, r.shift, rangesOf(settings), activeShifts(settings));
    if (res.kind === "revert") {
      toast.error(res.error); setTime(r.time); setTimeBad(true); return;
    }
    setTimeBad(false);
    if (res.kind === "save") { if (res.time !== r.time) onUpdate({ time: res.time }); return; }
    toast(res.message, { duration: 6000, action: { label: res.actionLabel, onClick: () => onUpdate({ time: res.time, shift: res.shift }) } });
    setTime(r.time);
  };

  const lbl = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className={cn("relative ruled-row", mismatch && "rounded-sm ring-2 ring-warning ring-inset bg-warning/10")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(ROW_GRID, "relative w-full py-2 text-left")}
      >
        <span className={cn("font-display font-semibold tabular-nums", dim)}>{r.time || "--:--"}</span>
        <span className={cn("flex min-w-0 items-center gap-1 font-hand text-lg text-ink", dim)}>
          <span className="truncate">{firstName(r.name) || "—"}</span>
          {mismatch && <AlertTriangle className="size-4 shrink-0 text-destructive" aria-label={mismatchText(mismatch)} />}
        </span>
        <span className={cn("justify-self-center rounded-full bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary", dim)}>{r.people}p</span>
        <span className={cn("whitespace-nowrap text-sm", dim)}>{r.outside ? "☀️ Fuori" : "🏠 Dentro"}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        {r.arrived && <span className="strike-line" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-dashed px-1 pb-4 pt-3 animate-in fade-in slide-in-from-top-1">
          {mismatch && (
            <div className="flex items-center gap-2 rounded-md border border-warning bg-warning/20 px-3 py-2 text-sm font-semibold">
              <AlertTriangle className="size-4 shrink-0 text-destructive" /> ⚠️ {mismatchText(mismatch)}
            </div>
          )}
          <div className="font-display text-xl">{r.name || "—"}</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={lbl}>Orario</div>
              <input value={time} onChange={(e) => setTime(e.target.value)} onBlur={commitTime} inputMode="numeric" placeholder="--:--"
                className={cn("w-full rounded-md border bg-paper px-3 py-2 font-display tabular-nums outline-none", timeBad && "border-destructive ring-1 ring-destructive")} />
            </div>
            <div>
              <div className={lbl}>Persone</div>
              <input type="number" min={1} value={people} onChange={(e) => setPeople(e.target.value)}
                onBlur={() => {
                  const n = Number(people);
                  if (Number.isInteger(n) && n >= 1) { if (n !== r.people) onUpdate({ people: n }); }
                  else { toast.error("Inserisci almeno 1 persona"); setPeople(String(r.people)); }
                }}
                className="w-full rounded-md border bg-paper px-3 py-2 font-display outline-none" />
            </div>
          </div>

          <div>
            <div className={lbl}>Telefono</div>
            <Input value={phone} type="tel" className="bg-paper" onChange={(e) => setPhone(e.target.value)}
              onBlur={() => { if (phone !== (r.phone ?? "")) { onUpdate({ phone }); onCustomerPhone(phone); } }} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button asChild variant="outline" disabled={!phone}><a href={`tel:${phone}`}><Phone /> 📞 Chiama</a></Button>
              <Button asChild variant="outline" disabled={!phone}><a href={whatsappLink(phone, r)} target="_blank" rel="noreferrer"><MessageCircle /> 💬 WhatsApp</a></Button>
            </div>
          </div>

          <div>
            <div className={lbl}>Tavolo</div>
            <Button variant="outline" onClick={() => setTableOpen(true)}
              className={cn("h-auto w-full justify-start py-2.5", label ? "border-primary/50 text-primary" : "border-dashed text-muted-foreground")}>
              <LayoutGrid /> <span className="truncate font-semibold">{label || "Assegna tavolo sulla mappa"}</span>
            </Button>
          </div>

          <div>
            <div className={lbl}>Richieste particolari</div>
            <input value={notes} placeholder="Allergie, intolleranze, note…" onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== r.notes && onUpdate({ notes })}
              className="w-full rounded-md border bg-paper px-3 py-2 font-hand text-base text-ink outline-none" />
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex items-center gap-2"><Checkbox checked={r.arrived} onCheckedChange={(v) => onUpdate({ arrived: !!v })} /> Arrivato</label>
            <label className="flex items-center gap-2"><Checkbox checked={r.outside} onCheckedChange={(v) => onUpdate({ outside: !!v })} /> Fuori</label>
            <label className="flex items-center gap-2"><Checkbox checked={r.is_new} onCheckedChange={(v) => onUpdate({ is_new: !!v })} /> Nuovo cliente</label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setMoveOpen(true)}><CalendarDays /> 📅 Sposta data</Button>
            <Button variant="outline" onClick={() => setDupOpen(true)}><Copy /> 📋 Duplica</Button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-dashed pt-3">
            <Button variant="secondary" onClick={() => setOpen(false)}><ArrowLeft /> Torna all'agenda</Button>
            {confirmDel ? (
              <span className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDel(false)}>No</Button>
                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={onDelete}>Sì, elimina</Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDel(true)}>
                <Trash2 className="size-3.5" /> Elimina
              </Button>
            )}
          </div>
        </div>
      )}

      <TableDialog open={tableOpen} onOpenChange={setTableOpen} reservation={r} others={others} onConfirm={(ids) => onUpdate({ table_ids: ids })} />
      <MoveDialog open={moveOpen} onOpenChange={setMoveOpen} r={r} dayExtra={dayExtra}
        onConfirm={(v) => { setMoveOpen(false); setOpen(false); onMove(v); }} />
      <DuplicateDialog open={dupOpen} onOpenChange={setDupOpen} r={r} dayExtra={dayExtra}
        onConfirm={async (v) => { if (await onDuplicate(v)) setDupOpen(false); }} />
    </div>
  );
}
