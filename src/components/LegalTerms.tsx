import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { COPYRIGHT_LINE, PRIVACY_ANCHOR, PRIVACY_CONTACT_EMAIL, SERVER_REGION_LINE, TERMS_TITLE } from '@/lib/legal';

/** Testo unificato: Condizioni Generali con informativa privacy (artt. 13-14 GDPR, D.Lgs. 196/2003). */
export function LegalTermsContent({ restaurant }: { restaurant?: string | undefined }) {
  const titolare = restaurant ? `il ristorante “${restaurant}”` : 'il ristorante presso cui viene effettuata la prenotazione';
  const goPrivacy = (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(PRIVACY_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return <article className="space-y-4 text-sm leading-relaxed">
    <section className="space-y-2">
      <h2 className="font-display text-xl">1. Oggetto del servizio</h2>
      <p>Segnatavolo è una piattaforma per la gestione delle prenotazioni dei ristoranti. Utilizzando il servizio, il ristorante, i suoi operatori e i clienti che prenotano accettano le presenti Condizioni Generali.</p>
      <h2 className="font-display text-xl">2. Uso corretto</h2>
      <p>Gli operatori si impegnano a inserire dati veritieri, a custodire le proprie credenziali e a usare il servizio solo per finalità di gestione della sala. Le prenotazioni sono soggette a disponibilità e alla conferma del ristorante.</p>
      <h2 className="font-display text-xl">3. Trattamento dei Dati Personali e Privacy</h2>
      <p>L'utilizzo del servizio è disciplinato dalla nostra <a href={`#${PRIVACY_ANCHOR}`} onClick={goPrivacy} className="font-semibold text-primary underline">Informativa Privacy</a>, redatta ai sensi degli artt. 13 e 14 del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003 (Codice Privacy italiano) e successive modifiche.</p>
      <h2 className="font-display text-xl">4. Limitazioni</h2>
      <p>Segnatavolo non è responsabile di mancate presentazioni, disdette o di accordi intercorsi direttamente tra cliente e ristorante.</p>
    </section>
    <section id={PRIVACY_ANCHOR} className="scroll-mt-4 space-y-2 border-t pt-4">
      <h2 className="font-display text-xl">Informativa Privacy (artt. 13 e 14 GDPR)</h2>
      <h3 className="font-bold">Ruoli del trattamento</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Titolare del Trattamento:</strong> {titolare}, per i dati anagrafici e di contatto dei clienti che prenotano.</li>
        <li><strong>Responsabile del Trattamento:</strong> la piattaforma Segnatavolo (Data Processor ex art. 28 GDPR), che garantisce la memorizzazione sicura, la non diffusione a terzi e la cifratura dei dati.</li>
      </ul>
      <h3 className="font-bold">Dati trattati</h3>
      <p>Nome e cognome, telefono, email, data, orario e numero di persone, note e richieste particolari (incluse eventuali allergie comunicate volontariamente).</p>
      <h3 className="font-bold">Finalità</h3>
      <p>Gestione delle prenotazioni e dell'accoglienza al tavolo; comunicazioni di servizio relative alla prenotazione (conferma, variazione, rifiuto). Le comunicazioni commerciali avvengono solo con consenso separato e facoltativo, revocabile in ogni momento.</p>
      <h3 className="font-bold">Base giuridica</h3>
      <p>Esecuzione di misure contrattuali e precontrattuali su richiesta dell'interessato (art. 6.1.b GDPR) e adempimento di obblighi di legge (art. 6.1.c GDPR); consenso (art. 6.1.a GDPR) per il solo marketing.</p>
      <h3 className="font-bold">Conservazione e sicurezza</h3>
      <p>I dati sono conservati per il tempo necessario alla gestione del servizio e agli obblighi di legge, in conformità a quanto indicato ({SERVER_REGION_LINE}), con accesso riservato agli operatori autorizzati del ristorante e credenziali cifrate.</p>
      <h3 className="font-bold">Diritti dell'interessato</h3>
      <p>Puoi esercitare in ogni momento i diritti di accesso, rettifica, cancellazione (oblio), limitazione, portabilità e opposizione (artt. 15-22 GDPR), oltre a proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>
      <h3 className="font-bold">Contatti (Titolare / DPO)</h3>
      <p>Rivolgiti direttamente al ristorante oppure scrivi a <a className="font-semibold text-primary underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>: inoltreremo la richiesta al Titolare entro i termini di legge.</p>
    </section>
    <p className="border-t pt-3 text-xs text-muted-foreground">{COPYRIGHT_LINE}</p>
  </article>;
}

/** Link che apre Termini e Privacy in una finestra, senza lasciare la pagina corrente. */
export function LegalTermsLink({ children, restaurant, className }: { children: ReactNode; restaurant?: string | undefined; className?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <a href="/termini" className={className ?? 'text-primary underline'} onClick={e => { e.preventDefault(); setOpen(true); }}>{children}</a>
    <LegalTermsDialog open={open} onOpenChange={setOpen} restaurant={restaurant} />
  </>;
}

export function LegalTermsDialog({ open, onOpenChange, restaurant }: { open: boolean; onOpenChange: (o: boolean) => void; restaurant?: string | undefined }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle className="font-display text-2xl">{TERMS_TITLE}</DialogTitle></DialogHeader>
      <LegalTermsContent restaurant={restaurant} />
    </DialogContent>
  </Dialog>;
}
