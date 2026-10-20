import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { reservationDateWarning } from "@/lib/date-warning";

export function DateWarning({ warning, acknowledged, onAcknowledge }: {
  warning: ReturnType<typeof reservationDateWarning>; acknowledged: boolean; onAcknowledge: (value: boolean) => void;
}) {
  if (!warning) return null;
  return <div role="status" className={cn("space-y-2 rounded-md border p-3 text-sm", warning.kind === "past" ? "border-warning bg-warning/20" : "border-primary/40 bg-primary/10")}>
    <p>{warning.text}</p>
    <label className="flex min-h-9 items-center gap-2 font-semibold"><Checkbox checked={acknowledged} onCheckedChange={(v) => onAcknowledge(v === true)} />Ho verificato data e orario</label>
  </div>;
}