import { useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSettings } from "@/lib/membership";
import { maskPhone } from "@/lib/privacy";

/** Telefono mascherato (Modalità Privacy): tocco o 👁️ lo svela per 10 secondi. */
export function MaskedPhone({ phone, empty = "senza telefono", children }: { phone: string | null | undefined; empty?: string; children?: (full: string) => ReactNode }) {
  const { privacy } = useSettings();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(false), 10000);
    return () => clearTimeout(t);
  }, [shown, phone]);
  if (!phone) return <span>{empty}</span>;
  if (!privacy) return <>{children ? children(phone) : <span>{phone}</span>}</>;
  const toggle = (e: React.MouseEvent | React.KeyboardEvent) => { e.stopPropagation(); e.preventDefault(); setShown((s) => !s); };
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {shown && children ? children(phone) : (
        <span role="button" tabIndex={0} onClick={toggle} onKeyDown={(e) => e.key === "Enter" && toggle(e)} className="cursor-pointer tabular-nums">{shown ? phone : maskPhone(phone)}</span>
      )}
      <span role="button" tabIndex={0} onClick={toggle} onKeyDown={(e) => e.key === "Enter" && toggle(e)}
        aria-label={shown ? "Nascondi numero" : "Mostra numero"} className="inline-grid size-6 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground hover:bg-accent">
        {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </span>
    </span>
  );
}
