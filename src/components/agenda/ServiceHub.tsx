import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardList, ChartNoAxesCombined, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmergencyButton } from "@/components/EmergencyButton";
import { shiftName, type Shift } from "@/lib/data";

export function ServiceHub({ date, shifts, selectedShift, onAvailability }: { date: string; shifts: Shift[]; selectedShift: Shift; onAvailability: (s: Shift) => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Shift>(selectedShift);
  const shift = shifts.includes(picked) ? picked : selectedShift;
  return <Dialog open={open} onOpenChange={(v) => { if (v) setPicked(selectedShift); setOpen(v); }}>
    <DialogTrigger asChild><Button size="sm" variant="secondary" disabled={!shifts.length}><ClipboardList /> Sala &amp; Servizio</Button></DialogTrigger>
    <DialogContent className="max-w-md bg-paper">
      <DialogHeader><DialogTitle>Gestione Sala e Documenti</DialogTitle></DialogHeader>
      <div className="text-sm font-semibold">{date.split("-").reverse().join("/")}</div>
      <Select value={shift} onValueChange={(v) => { if (v === "pranzo" || v === "sera" || v === "colazione") setPicked(v); }}>
        <SelectTrigger aria-label="Turno Sala e Servizio"><SelectValue /></SelectTrigger>
        <SelectContent>{shifts.map((s) => <SelectItem key={s} value={s}>{shiftName(s)}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex flex-col gap-2">
        <Button variant="outline" className="h-auto min-h-12 justify-start whitespace-normal text-left" onClick={() => { setOpen(false); onAvailability(shift); }}><ChartNoAxesCombined /> Situazione &amp; Disponibilità Tavoli</Button>
        <Button asChild variant="outline" className="h-auto min-h-12 justify-start"><Link to="/foglio" search={{ d: date, s: shift }}><Printer /> Stampa Foglio di Sala</Link></Button>
        <EmergencyButton date={date} shifts={[shift]} className="h-auto min-h-12 justify-start" />
      </div>
    </DialogContent>
  </Dialog>;
}