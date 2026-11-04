import { SUB_PROCESSORS, controllerName, noShowTolerance, type RestaurantLegal } from '@/lib/restaurant-legal';

/** Informativa Privacy (artt. 13-14 GDPR) e Condizioni di Prenotazione generate per il singolo ristorante. */
export function RestaurantLegalContent({ r }: { r: RestaurantLegal }) {
  const titolare = controllerName(r);
  const tolerance = noShowTolerance(r.no_show_tolerance_minutes);
  const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-6 font-display text-xl">{children}</h2>;
  return <article className="space-y-3 text-sm leading-relaxed">
    {r.custom_privacy_url && <p className="rounded-md border bg-muted/40 p-3">Il ristorante pubblica anche una propria informativa completa: <a className="font-semibold text-primary underline" href={r.custom_privacy_url} target="_blank" rel="noopener noreferrer">consulta l’informativa sul sito di {r.name}</a>.</p>}
    <H>1. Titolare del Trattamento</H>
    <ul className="list-disc space-y-1 pl-5">
      <li><strong>Titolare (Data Controller):</strong> {titolare}{r.legal_name && r.legal_name !== r.name ? ` (insegna “${r.name}”)` : ''}</li>
      {r.vat_number && <li><strong>P. IVA / C.F.:</strong> {r.vat_number}</li>}
      {r.registered_address && <li><strong>Sede legale:</strong> {r.registered_address}</li>}
      {r.privacy_email && <li><strong>Email privacy:</strong> <a className="text-primary underline" href={`mailto:${r.privacy_email}`}>{r.privacy_email}</a></li>}
    </ul>
    <p><strong>Responsabile del Trattamento (art. 28 GDPR):</strong> la piattaforma Segnatavolo, che fornisce al ristorante l’infrastruttura tecnologica, il database e i motori di notifica, trattando i dati solo su istruzione del Titolare.</p>
    <p><strong>Sub-responsabili:</strong></p>
    <ul className="list-disc space-y-1 pl-5">{SUB_PROCESSORS.map(s => <li key={s.name}><strong>{s.role}:</strong> {s.name} — {s.note}</li>)}</ul>

    <H>2. Dati raccolti</H>
    <ul className="list-disc space-y-1 pl-5">
      <li><strong>Dati anagrafici e di contatto:</strong> nome, cognome, telefono, email.</li>
      <li><strong>Dati di servizio:</strong> data, turno, orario, numero di persone, storico prenotazioni e mancate presentazioni (no-show).</li>
      <li><strong>Dati particolari forniti spontaneamente nelle note:</strong> allergie, intolleranze alimentari, esigenze legate a disabilità, richiesta di seggioloni.</li>
    </ul>

    <H>3. Finalità e base giuridica</H>
    <ul className="list-disc space-y-1 pl-5">
      <li><strong>Gestione della prenotazione</strong> (verifica disponibilità, assegnazione tavolo): esecuzione di misure contrattuali e precontrattuali, art. 6.1.b GDPR.</li>
      <li><strong>Comunicazioni operative e di servizio</strong> via Email e WhatsApp Business (presa in carico, conferma dell’operatore{r.morning_reminder_enabled ? ', richiesta di riconferma mattutina alle 09:00' : ''}, avvisi di modifica e cancellazione): art. 6.1.b GDPR.</li>
      <li><strong>Dati relativi alla salute</strong> (allergie e intolleranze indicate dall’interessato) per fini di sicurezza alimentare: consenso esplicito, art. 9.2.a GDPR, espresso inserendoli volontariamente.</li>
      <li><strong>Comunicazioni commerciali/newsletter:</strong> solo con consenso separato e facoltativo (art. 6.1.a GDPR), mai preselezionato e revocabile in ogni momento.</li>
    </ul>

    <H>4. Condizioni di Prenotazione e regole di sala</H>
    <ul className="list-disc space-y-1 pl-5">
      <li>La richiesta online è soggetta alla conferma del ristorante.</li>
      {r.morning_reminder_enabled && <li>Il ristorante può chiedere di <strong>riconfermare la prenotazione la mattina stessa</strong> del servizio; la mancata riconferma può comportarne l’annullamento.</li>}
      <li>Puoi <strong>disdire o chiedere una modifica</strong> in qualsiasi momento tramite il link univoco di gestione ricevuto con la conferma.</li>
      <li>Oltre <strong>{tolerance} minuti</strong> di ritardo non comunicato la prenotazione può essere annullata e il tavolo riassegnato.</li>
      <li>Nei giorni con doppio turno, il <strong>Primo Turno</strong> ha una durata fissa di {r.first_shift_duration_minutes} minuti; il <strong>Secondo Turno</strong> prosegue fino a chiusura.</li>
    </ul>

    <H>5. Tempi di conservazione</H>
    <p>I dati sono conservati per il tempo strettamente necessario all’evasione del servizio e alla gestione dello storico clienti del ristorante, salvo revoca del consenso o richiesta di cancellazione, e comunque nei limiti degli obblighi di legge. I server si trovano nell’Unione Europea.</p>

    <H>6. Diritti dell’interessato (artt. 15-22 GDPR)</H>
    <p>Puoi esercitare i diritti di accesso, rettifica, cancellazione (diritto all’oblio), limitazione, portabilità e opposizione al trattamento{r.privacy_email ? <> scrivendo a <a className="font-semibold text-primary underline" href={`mailto:${r.privacy_email}`}>{r.privacy_email}</a></> : ' contattando direttamente il ristorante'}. Hai inoltre diritto di proporre reclamo al Garante per la protezione dei dati personali (<a className="text-primary underline" href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">www.garanteprivacy.it</a>).</p>
  </article>;
}
