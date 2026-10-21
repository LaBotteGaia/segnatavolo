import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { clearAssist, useAssist } from "@/lib/assist";

/** Banner fisso mostrato in cima a ogni schermata mentre la Modalità Assistenza è attiva. */
export function AssistBanner() {
  const assist = useAssist();
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (!assist) return null;
  const back = () => {
    clearAssist();
    qc.clear();
    navigate({ to: "/admin" });
  };
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-400 px-3 py-2 text-center text-sm font-bold text-amber-950 shadow-md">
      <TriangleAlert className="size-4 shrink-0" />
      <span className="min-w-0 truncate">MODALITÀ ASSISTENZA ATTIVA: stai operando sul ristorante {assist.name}</span>
      <button type="button" onClick={back} className="shrink-0 rounded-md border border-amber-900/40 bg-amber-50 px-2 py-0.5 text-xs font-semibold hover:bg-amber-100">
        Torna al Pannello Admin
      </button>
    </div>
  );
}
