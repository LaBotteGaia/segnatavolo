import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadEmergency } from "@/lib/emergency";
import { useMembership, useSettings } from "@/lib/membership";
import type { Reservation, Room, RTable, Shift } from "@/lib/data";

export function EmergencyButton({ date = format(new Date(), "yyyy-MM-dd"), shifts, className }: { date?: string; shifts?: Shift[]; className?: string }) {
  const qc = useQueryClient(); const { data: me } = useMembership(); const settings = useSettings();
  const save = () => {
    const rows = qc.getQueryData<Reservation[]>(["reservations", date]);
    const rooms = qc.getQueryData<Room[]>(["rooms"]); const tables = qc.getQueryData<RTable[]>(["tables"]);
    if (!me || !rows || !rooms || !tables) { toast.error("Apri l’agenda della data da esportare e attendi il caricamento"); return; }
    downloadEmergency({ name: me.restaurants?.name ?? "Segnatavolo", date, shifts, rows, rooms, tables, settings });
    toast.success("Piano di sala salvato sul dispositivo");
  };
  return <Button variant="outline" size="sm" className={className} onClick={save}><Save /> <span className="min-w-0 whitespace-normal text-left">Esporta Piano di Sala (Emergenza)</span></Button>;
}