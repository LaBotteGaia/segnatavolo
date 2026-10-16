import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useConnectionStatus, type ConnState } from "@/lib/connection";

const DOT: Record<ConnState, string> = {
  online: "bg-green-500",
  degraded: "bg-yellow-400",
  offline: "bg-red-500",
};

const LABEL: Record<ConnState, string> = {
  online: "✅ Connesso a Supabase Cloud (Dati sincronizzati in tempo reale)",
  degraded: "⚠️ Riconnessione in corso o connessione lenta",
  offline: "❌ Disconnesso dal Database. Le nuove prenotazioni potrebbero non essere salvate sul cloud.",
};

const TITLE: Record<ConnState, string> = {
  online: "Connesso al database",
  degraded: "Connessione lenta o in riconnessione",
  offline: "Disconnesso dal database",
};

export function ConnectionDot({ className }: { className?: string }) {
  const { state, pingMs, error, checking, testNow } = useConnectionStatus();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={TITLE[state]} title={TITLE[state]}
          className={`relative inline-block size-2.5 shrink-0 rounded-full ${DOT[state]} ${state !== "online" ? "animate-pulse" : ""} ${className ?? ""}`}>
          <span className={`absolute inset-0 rounded-full ${DOT[state]} opacity-60 ${state === "online" ? "animate-ping [animation-duration:2.5s]" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" align="center">
        <div className="font-display text-base">Stato Connessione Database</div>
        <div className="mt-2 flex items-start gap-2">
          <span className={`mt-1.5 inline-block size-2.5 shrink-0 rounded-full ${DOT[state]}`} />
          <span>{LABEL[state]}</span>
        </div>
        {state === "online" && pingMs !== null && (
          <div className="mt-2 text-xs text-muted-foreground">Tempo di risposta: {pingMs} ms</div>
        )}
        {state === "degraded" && pingMs !== null && (
          <div className="mt-2 text-xs text-muted-foreground">Risposta lenta: {pingMs} ms</div>
        )}
        {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
        <Button variant="outline" size="sm" className="mt-3 w-full" disabled={checking} onClick={testNow}>
          🔄 {checking ? "Verifica in corso…" : "Testa connessione adesso"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
