import { formatInTimeZone } from "@/lib/audit";
import { DateWarning } from "./DateWarning";
import { reservationDateWarning } from "@/lib/date-warning";
import { useLiveRow } from "@/lib/live-sync";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoyaltyBox } from "./Extras";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ArrowLeft, CalendarDays, ChevronDown, Copy, LayoutGrid, Lock, LockOpen, MessageCircle, Phone, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  activeShifts, commitTimeCheck, firstName, mismatchText, rangesOf, tableLabel, extrasText, whatsappLink, zoneMismatch,
  useRooms, useTables, type Reservation, type Shift,
} from "@/lib/data";
import { useSettings } from "@/lib/membership";
import { TableDialog } from "./TableDialog";
import { DURATION_PRESETS, WHOLE_EVENING, durLabel, rotationNote } from "@/lib/rotation";
import { MoveDialog, DuplicateDialog } from "./MoveDuplicateDialogs";
import { isNoShow } from "@/lib/no-show";
import { useServiceClock } from "@/lib/extras";
import { MaskedPhone } from "@/components/MaskedPhone";

export const ROW_GRID = "grid items-center gap-x-1 grid-cols-[2rem_3rem_minmax(0,1fr)_2.3rem_4.5rem_1rem] lg:gap-x-3 xl:grid-cols-[2.5rem_3.5rem_minmax(0,1fr)_3rem_5.5rem_1.25rem]";

export function ReservationRow({
  r, others, onUpdate, onDelete, onCustomerPhone, onMove, onDuplicate, dayExtra = null, highlight = false,
}: {
  highlight?: boolean;
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
  const now = useServiceClock();
  const liveChange = useLiveRow(r.id);
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const [pendingTime, setPendingTime] = useState<Partial<Reservation> | null>(null);
  const warning = reservationDateWarning(r.date, (pendingTime?.shift ?? r.shift) as Shift, pendingTime?.time ?? r.time, rangesOf(settings), now);
  const confirmTime = (patch: Partial<Reservation>) => {
    const w = reservationDateWarning(r.date, (patch.shift ?? r.shift) as Shift, patch.time ?? r.time, rangesOf(settings), now);
    if (w && acknowledged !== w.key) { setPendingTime(patch); return; }
    onUpdate(patch);
  };
  const noShow = isNoShow(r, rangesOf(settings), now);
  const setArrived = (v: boolean) => onUpdate({ arrived: v, no_show: false });
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(r.notes);
  const [time, setTime] = useState(r.time);
  const [phone, setPhone] = useState(r.phone ?? "");
  const [people, setPeople] = useState(String(r.people));
  const [adv, setAdv] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [timeBad, setTimeBad] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { if (!open) setConfirmDel(false); }, [open]);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (highlight) { setOpen(true); setTimeout(() => rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150); } }, [highlight]);
  useEffect(() => setPeople(String(r.people)), [r.people]);
  useEffect(() => setNotes(r.notes), [r.notes]);
  useEffect(() => setTime(r.time), [r.time]);
  useEffect(() => setPhone(r.phone ?? ""), [r.phone]);

  const cfg = { duration: settings.duration, buffer: settings.buffer };
  const label = r.table_ids.length ? tableLabel(r.table_ids, tables, rooms) + extrasText(r) + rotationNote(r, others, cfg) : "";
  const dur = r.duration_min ?? settings.duration;
  const buf = r.buffer_min ?? settings.buffer;
  const mismatch = zoneMismatch(r, tables, rooms);
  const dim = r.arrived && "opacity-60 text-muted-foreground";

  const commitTime = () => {
    const res = commitTimeCheck(time, r.shift, rangesOf(settings), activeShifts(settings));
    if (res.kind === "revert") {
      toast.error(res.error); setTime(r.time); setTimeBad(true); return;
    }
    setTimeBad(false);
    if (res.kind === "save") { if (res.time !== r.time) confirmTime({ time: res.time }); return; }
    toast(res.message, { duration: 6000, action: { label: res.actionLabel, onClick: () => confirmTime({ time: res.time, shift: res.shift }) } });
    setTime(r.time);
  };

  const lbl = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div ref={rowRef} className={cn("relative ruled-row scroll-mt-64 agenda-wide:scroll-mt-20", liveChange && "live-row-flash", highlight && "rounded-sm ring-2 ring-primary bg-primary/10", mismatch && "rounded-sm ring-2 ring-warning ring-inset bg-warning/10")}>
      <div className={cn(ROW_GRID, "relative min-h-11")}>
        <div className="relative z-10 grid min-h-11 place-items-center">
          <Checkbox className="size-6 bg-paper" aria-label={`Arrivato: ${r.name}`} checked={r.arrived} onCheckedChange={(v) => setArrived(v === true)} />
        </div>
      <Button variant="ghost"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Dettagli prenotazione: ${r.name}`}
        className="col-span-5 grid h-auto min-w-0 grid-cols-subgrid gap-x-1 whitespace-normal rounded-none px-0 py-2 text-left font-normal hover:bg-accent/40"
      >
        <span className={cn("font-display font-semibold tabular-nums", dim)}>{r.time || "--:--"}</span>
        <span className={cn("flex min-w-0 flex-col", dim)}>
          <span className="flex min-w-0 items-center gap-1 font-hand text-lg leading-tight text-ink">
            <span className="truncate xl:whitespace-normal xl:break-words">{firstName(r.name) || "—"}</span>
            {mismatch && <AlertTriangle className="size-4 shrink-0 text-destructive" aria-label={mismatchText(mismatch)} />}
            {r.tavolo_bloccato && <Lock className="size-3.5 shrink-0 text-destructive" aria-label="Tavolo bloccato: escluso dalla riorganizzazione automatica" />}
          </span>
          {label && <span className="truncate xl:whitespace-normal text-[11px] xl:text-xs font-semibold leading-tight text-primary">{label}</span>}
          {noShow && <span className="text-xs font-semibold text-destructive">No-Show</span>}
        </span>
        <span className={cn("justify-self-center rounded-full bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary", dim)}>{r.people}p</span>
        <span className={cn("whitespace-nowrap text-sm", dim)}>{r.outside ? "☀️ Fuori" : "🏠 Dentro"}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </Button>
        {r.arrived && <span className="strike-line z-20" />}
      </div>

      {open && (
        <div className="space-y-3 border-t border-dashed px-1 pb-4 pt-3 animate-in fade-in slide-in-from-top-1">
          {mismatch && (
            <div className="flex items-center gap-2 rounded-md border border-warning bg-warning/20 px-3 py-2 text-sm font-semibold">
              <AlertTriangle className="size-4 shrink-0 text-destructive" /> {mismatchText(mismatch)}
            </div>
          )}
          <div className="font-display text-xl">{r.name || "—"}</div>
          <LoyaltyBox customerId={r.customer_id} phone={r.phone} />

          <DateWarning warning={warning} acknowledged={!!warning && acknowledged === warning.key} onAcknowledge={(v) => { setAcknowledged(v ? warning?.key ?? null : null); if (v && pendingTime) { onUpdate(pendingTime); setPendingTime(null); } }} />
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
            {(() => { const inp = () => <Input value={phone} type="tel" className="bg-paper" onChange={(e) => setPhone(e.target.value)}
              onBlur={() => { const normalized = phone.replace(/[\s\-.\/()]/g, ""); setPhone(normalized); if (normalized !== (r.phone ?? "")) { onUpdate({ phone: normalized }); onCustomerPhone(normalized); } }} />;
              return r.phone ? <div className="flex min-h-10 items-center rounded-md border bg-paper px-3"><MaskedPhone phone={r.phone}>{inp}</MaskedPhone></div> : inp(); })()}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button asChild variant="outline" disabled={!phone}><a href={`tel:${phone}`}><Phone /> Chiama</a></Button>
              <Button asChild variant="outline" disabled={!phone}><a href={whatsappLink(phone, r)} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className={lbl}>Tavolo</div>
              <button type="button" onClick={() => onUpdate({ tavolo_bloccato: !r.tavolo_bloccato })}
                aria-label={r.tavolo_bloccato ? "Sblocca il tavolo: la riorganizzazione automatica potrà spostarlo" : "Blocca il tavolo: la riorganizzazione automatica non lo sposterà"}
                title={r.tavolo_bloccato ? "Tavolo bloccato: protetto dalla riorganizzazione automatica" : "Tavolo libero di essere riorganizzato"}
                className={cn("flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold", r.tavolo_bloccato ? "border-destructive bg-destructive/10 text-destructive" : "text-muted-foreground")}>
                {r.tavolo_bloccato ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                {r.tavolo_bloccato ? "Bloccato" : "Libero"}
              </button>
            </div>
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
            <label className="flex items-center gap-2"><Checkbox checked={r.arrived} onCheckedChange={(v) => setArrived(v === true)} /> Arrivato</label>
            <label className="flex items-center gap-2"><Checkbox checked={r.outside} onCheckedChange={(v) => onUpdate({ outside: !!v })} /> Fuori</label>
            <label className="flex items-center gap-2"><Checkbox checked={r.is_new} onCheckedChange={(v) => onUpdate({ is_new: !!v })} /> Nuovo cliente</label>
          </div>

          {!r.arrived && <Button variant="outline" className="w-full border-warning text-destructive" disabled={noShow && !r.no_show} onClick={() => onUpdate({ no_show: !r.no_show, arrived: false })}>
            {r.no_show ? "Annulla No-Show manuale" : noShow ? "No-Show rilevato a fine servizio" : "Segna come No-Show"}
          </Button>}

          <Button variant="outline" className="w-full" onClick={() => setMoveOpen(true)}><CalendarDays /> Sposta data</Button>

          <button type="button" onClick={() => setAdv(!adv)} className="text-left text-sm font-semibold text-muted-foreground hover:text-foreground">
            {adv ? "▴ Nascondi opzioni avanzate" : "⚙️ Mostra opzioni avanzate ▾"}
          </button>
          {adv && (
            <div className="space-y-3 rounded-md border border-dashed p-3">
          <div>
            <div className={lbl}>Permanenza al tavolo</div>
            <div className="flex flex-wrap gap-1">
              {[...DURATION_PRESETS, WHOLE_EVENING].map((d) => (
                <button key={d} type="button" onClick={() => onUpdate({ duration_min: d })}
                  className={cn("rounded-md border px-2 py-1 text-xs font-semibold", dur === d ? "bg-primary text-primary-foreground" : "bg-paper")}>
                  {d < 0 ? "Tutta la sera / No rotazione" : durLabel(d)}
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs">Buffer pulizia
              <select value={buf} onChange={(e) => onUpdate({ buffer_min: Number(e.target.value) })} className="rounded-md border bg-paper px-2 py-1">
                {[0, 5, 10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
          </div>

              <Button variant="outline" size="sm" onClick={() => setTableOpen(true)}>+ Sponda / + Barella (dalla mappa tavoli)</Button>
              <Button variant="outline" className="w-full" onClick={() => setDupOpen(true)}><Copy /> Duplica prenotazione</Button>
              {r.tags?.length > 0 && <p className="text-xs">Etichette: {r.tags.join(", ")}</p>}
            </div>
          )}

          <div className="space-y-1 text-xs text-muted-foreground">
            <p>📝 Presa da: {r.created_by_name || "Operatore non registrato"} il {formatInTimeZone(r.created_at)}</p>
            {r.updated_at && <p>✏️ Ultima modifica: {r.updated_by_name || "Operatore non registrato"} il {formatInTimeZone(r.updated_at)}</p>}
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

      <TableDialog date={r.date} open={tableOpen} onOpenChange={setTableOpen} reservation={r} others={others} extras={r} onConfirm={(ids, ex) => onUpdate({ table_ids: ids, ...ex })} />
      <MoveDialog open={moveOpen} onOpenChange={setMoveOpen} r={r} dayExtra={dayExtra}
        onConfirm={(v) => { setMoveOpen(false); setOpen(false); onMove(v); }} />
      <DuplicateDialog open={dupOpen} onOpenChange={setDupOpen} r={r} dayExtra={dayExtra}
        onConfirm={async (v) => { if (await onDuplicate(v)) setDupOpen(false); }} />
    </div>
  );
}
