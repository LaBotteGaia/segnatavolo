import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_VERSION } from "@/lib/extras";
import { CHANGELOG, SEEN_VERSION_KEY } from "@/lib/changelog";

export function ChangelogDialog({ open, onOpenChange, onlyCurrent }: { open: boolean; onOpenChange: (o: boolean) => void; onlyCurrent?: boolean }) {
  const list = onlyCurrent ? CHANGELOG.filter((r) => r.version === APP_VERSION) : CHANGELOG;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-paper">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {onlyCurrent ? `Novità di ${APP_NAME} ${APP_VERSION}` : `Storico versioni di ${APP_NAME}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {list.map((r) => (
            <section key={r.version}>
              {!onlyCurrent && <h3 className="font-display text-lg text-primary">{r.version} <span className="text-sm text-muted-foreground">· {r.date}</span></h3>}
              <ul className="ml-5 list-disc space-y-1 text-sm">{r.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </section>
          ))}
        </div>
        <Button size="lg" onClick={() => onOpenChange(false)}>Ho capito / Continua</Button>
      </DialogContent>
    </Dialog>
  );
}

/** Apre da solo le novità la prima volta che questo dispositivo vede la versione corrente. */
export function WhatsNew() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(SEEN_VERSION_KEY) !== APP_VERSION) setOpen(true); } catch { /* storage non disponibile */ }
  }, []);
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) try { localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION); } catch { /* ignore */ }
  };
  return <ChangelogDialog open={open} onOpenChange={close} onlyCurrent />;
}
