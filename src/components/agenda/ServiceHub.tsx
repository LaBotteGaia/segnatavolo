import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardList, ChartNoAxesCombined, Printer, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmergencyButton } from "@/components/EmergencyButton";
import { shiftName, type Shift } from "@/lib/data";

export function ServiceHub({ date, shifts, selectedShift, onAvailability, onLive, requestedOpen, onRequestedClose }: { onLive?: () => void; requestedOpen?: boolean | undefined; onRequestedClose?: () => void; date: string; shifts: Shift[]; selectedShift: Shift; onAvailability: (s: Shift) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (requestedOpen) setOpen(true); }, [requestedOpen]);
  const [picked, setPicked] = useState<Shift>(selectedShift);
  const shift = shifts.includes(picked) ? picked : selectedShift;
  return <Dialog open={open} onOpenChange={(v) => { if (v) setPicked(selectedShift); setOpen(v); if (!v) onRequestedClose?.(); }}>
    <DialogTrigger asChild><Button size="sm" variant="secondary" disabled={!shifts.length}><ClipboardList /> <span className="agenda-wide:hidden">Strumenti</span><span className="hidden agenda-wide:inline">Strumenti di Servizio</span></Button></DialogTrigger>
    <DialogContent className="max-w-md bg-paper">
      <DialogHeader><DialogTitle>Strumenti di Servizio</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground">Scegli il turno: la Sala Live gestisce arrivi e tavoli in tempo reale; disponibilità, foglio di sala e piano offline usano il turno selezionato.</p>
      <div className="text-sm font-semibold">{date.split("-").reverse().join("/")}</div>
      <Select value={shift} onValueChange={(v) => { if (v === "pranzo" || v === "sera" || v === "colazione") setPicked(v); }}>
        <SelectTrigger aria-label="Turno Sala e Servizio"><SelectValue /></SelectTrigger>
        <SelectContent>{shifts.map((s) => <SelectItem key={s} value={s}>{shiftName(s)}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex flex-col gap-2">
        {onLive && <Button className="h-auto min-h-12 justify-start whitespace-normal text-left" title="Mappa live: arrivi, sposta/scambia tavoli, accomoda al volo" onClick={() => { setOpen(false); onRequestedClose?.(); onLive(); }}><Radio /> Modalità Sala Live</Button>}
        <Button variant="outline" className="h-auto min-h-12 justify-start whitespace-normal text-left" onClick={() => { setOpen(false); onRequestedClose?.(); onAvailability(shift); }}><ChartNoAxesCombined /> Situazione &amp; Disponibilità Tavoli</Button>
        <Button asChild variant="outline" className="h-auto min-h-12 justify-start"><Link to="/foglio" search={{ d: date, s: shift }}><Printer /> Stampa Foglio di Sala</Link></Button>
        <EmergencyButton date={date} shifts={[shift]} className="h-auto min-h-12 justify-start" />
      </div>
    </DialogContent>
  </Dialog>;
}