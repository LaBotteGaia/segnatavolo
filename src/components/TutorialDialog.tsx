import { useEffect, useRef, useState } from "react";
import { BookOpen, CalendarDays, CheckSquare, Clock3, LayoutGrid, Users } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/extras";

export const TUTORIAL_SEEN_KEY = "segnatavolo-tutorial-seen";

const SLIDES = [
  {
    icon: BookOpen,
    title: "📖 L'Agenda di Sala",
    text: "Gestisci Pranzo e Cena con un colpo d'occhio. Scorri con il dito verso destra o sinistra per sfogliare i giorni. Usa il tasto 'Oggi' e la barra in alto per cercare al volo qualsiasi prenotazione.",
  },
  {
    icon: CheckSquare,
    title: "✅ Arrivo Clienti in Tempo Reale",
    text: "Appena i clienti arrivano al ristorante, tocca la casella quadrata sulla riga: il tavolo verrà immediatamente sbarrato per avere sempre sotto controllo chi manca all'appello.",
  },
  {
    icon: LayoutGrid,
    title: "🪑 Mappa Tavoli, Pareti e Sponde",
    text: "Visualizza la sala fedelmente con muri e ostacoli. I tavoli si colorano in base alla disponibilità. Se una tavolata è più numerosa, aggiungi al volo una sponda (capotavola) o una barella!",
  },
  {
    icon: Clock3,
    title: "⏱️ Rotazione Tavoli & Situazione Disponibilità",
    text: "I tavoli gestiscono automaticamente il secondo turno (1h 30m di permanenza + 15m di riallestimento). Apri 'Situazione Tavoli' per vedere istantaneamente quali tavoli sono liberi al 1° o 2° turno mentre hai il cliente al telefono.",
  },
  {
    icon: Users,
    title: "👥 Rubrica Clienti & Note Fisse",
    text: "Memorizza contatti con telefoni multipli e allergie fisse che si inseriscono da sole. Il sistema calcola lo storico delle visite e ti avverte con un alert in caso di No-Show precedente.",
  },
];

export function TutorialDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [index, setIndex] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const last = index === SLIDES.length - 1;

  useEffect(() => { if (open) setIndex(0); }, [open]);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) try { localStorage.setItem(TUTORIAL_SEEN_KEY, "1"); } catch { /* ignore */ }
  };

  const slide = SLIDES[index]!;
  const Icon = slide.icon;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex h-[100dvh] w-full max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-lg" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Guida rapida di {APP_NAME}</DialogTitle>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Guida rapida</span>
          <button onClick={() => close(false)} className="text-sm font-semibold text-muted-foreground underline underline-offset-2">Salta guida</button>
        </div>

        <div
          className="flex flex-1 flex-col items-center justify-center gap-5 overflow-hidden px-8 text-center"
          data-no-swipe
          onTouchStart={(e) => { touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }; }}
          onTouchEnd={(e) => {
            const t = touch.current; touch.current = null;
            if (!t) return;
            const dx = e.changedTouches[0]!.clientX - t.x, dy = e.changedTouches[0]!.clientY - t.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              setIndex((i) => Math.min(SLIDES.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1))));
            }
          }}
        >
          <div className="flex size-24 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-12" />
          </div>
          <h2 className="font-display text-2xl">{slide.title}</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{slide.text}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" /> {index + 1} di {SLIDES.length}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pb-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              aria-label={`Vai alla scheda ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`size-2.5 rounded-full transition-colors ${i === index ? "bg-primary" : "bg-muted-foreground/30"}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 border-t p-4">
          <Button variant="outline" className="flex-1" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            ← Indietro
          </Button>
          {last ? (
            <Button className="flex-1" onClick={() => close(false)}>Inizia a usare {APP_NAME}</Button>
          ) : (
            <Button className="flex-1" onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}>Avanti →</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Apre da solo la guida la prima volta che questo dispositivo apre l'app. */
export function TutorialAutoOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) setOpen(true); } catch { /* storage non disponibile */ }
  }, []);
  return <TutorialDialog open={open} onOpenChange={setOpen} />;
}
