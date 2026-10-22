import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActiveRestaurantId } from "@/lib/tenant";
import { getAiSettings, parseVoiceBooking } from "@/lib/voice-ai.functions";
import type { VoiceBooking } from "@/lib/voice-ai";
import { cn } from "@/lib/utils";

type Rec = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const romeToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());

export function VoiceDictation({ onResult, className }: { onResult: (b: VoiceBooking) => void; className?: string }) {
  const rid = useActiveRestaurantId();
  const load = useServerFn(getAiSettings), parse = useServerFn(parseVoiceBooking);
  const { data: cfg } = useQuery({ queryKey: ["ai-settings", rid], enabled: !!rid, queryFn: () => load({ data: { id: rid! } }), staleTime: 60_000 });
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState("");
  const [review, setReview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rec = useRef<Rec | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const text = useRef("");
  useEffect(() => () => { clearTimeout(timer.current); rec.current?.abort(); }, []);

  const stop = () => { clearTimeout(timer.current); rec.current?.stop(); };
  const start = () => {
    if (!cfg?.ready) { toast.info("Per usare la dettatura vocale, inserisci prima la tua chiave API in Configurazione Servizio"); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { toast.error("Questo browser non supporta il riconoscimento vocale: usa Chrome, Edge o Safari"); return; }
    r.onerror = (e) => { if (e.error === "not-allowed") toast.error("Consenti l'uso del microfono per dettare"); };
    // Ascolto single-shot: continuous=false e interimResults=false evitano gli echi
    // su mobile (Chrome Android / iOS). Il sistema restituisce un solo risultato
    // finale quando l'operatore smette di parlare.
    r.onresult = (e) => {
      const results = e.results;
      const last = results[results.length - 1];
      if (!last) return;
      // Solo l'ultimo risultato valido, sovrascrive qualsiasi testo precedente.
      const transcript = (last[0]?.transcript ?? "").trim().replace(/\s+/g, " ");
      if (transcript) { text.current = transcript; setReview(transcript); }
    };
    r.onend = () => { setListening(false); rec.current = null; setReview(text.current); };
    rec.current = r; r.start(); setListening(true);
  };

  const confirm = async () => {
    if (!rid || !review?.trim()) return;
    setBusy(true);
    try {
      const r = await parse({ data: { restaurant_id: rid, transcript: review, current_date: romeToday() } });
      if (!r.ok) { toast.error(r.message); return; }
      setReview(null); onResult(r.booking);
    } catch { toast.error("Elaborazione non riuscita"); } finally { setBusy(false); }
  };

  return (
    <>
      <Button type="button" variant="secondary" onClick={listening ? stop : start} aria-label={listening ? "Termina ascolto" : "Dettatura Rapida"}
        className={cn("min-w-0 whitespace-normal px-2", listening && "animate-pulse bg-destructive text-destructive-foreground hover:bg-destructive/90", className)}>
        <Mic /> <span className={listening ? "" : "hidden sm:inline"}>{listening ? "In ascolto... Parla ora" : "🎙️ Dettatura Rapida"}</span>
      </Button>
      {listening && <div role="status" className="w-full rounded-md bg-paper px-3 py-2 text-sm text-foreground shadow">{live || "…"}</div>}
      <Dialog open={review !== null} onOpenChange={(o) => { if (!o && !busy) setReview(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verifica dettatura</DialogTitle></DialogHeader>
          <Textarea autoFocus rows={4} value={review ?? ""} onChange={(e) => setReview(e.target.value)} placeholder="Nessun testo riconosciuto: scrivi o riprova"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void confirm(); } }} />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setReview(null)}>🔄 Riprova / Annulla</Button>
            <Button type="button" disabled={busy || !review?.trim()} onClick={confirm}>{busy && <Loader2 className="animate-spin" />}✅ Conferma ed Elabora</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
