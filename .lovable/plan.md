# Prenotazioni online: disponibilità, approvazione e posta

## Risultato
Completare il canale pubblico di Segnatavolo senza modificare le funzioni già presenti, mantenendo SMTP personalizzato e la scelta del servizio email predefinito.

## 1. Disponibilità per orario
- Scegliere prima data, turno e orario, poi il numero di persone.
- Calcolare i posti residui considerando sale aperte, occupazioni nell’intervallo, durata, riallestimento, doppi turni e margine di riserva.
- Aggiungere il limite comitiva nelle impostazioni del ristorante; il selettore non supera né tale limite né i posti residui.
- Disabilitare gli orari completi e mostrare gli avvisi di disponibilità limitata e grandi comitive.
- Ripetere il controllo al salvataggio per gestire richieste contemporanee.

## 2. Approvazione in sala
- Salvare le nuove richieste online come **In attesa**; le prenotazioni esistenti restano confermate.
- Mostrare nell’agenda un avviso persistente con tutte le richieste in attesa del ristorante attivo, anche di altre date.
- **Accetta e Assegna** propone il tavolo tramite il motore esistente, consente la scelta manuale e verifica nuovamente disponibilità e conflitti prima della conferma.
- **Rifiuta** richiede una motivazione, conserva la richiesta e libera la disponibilità.
- Le richieste in attesa trattengono i posti per evitare sovraprenotazioni, ma non diventano presenze, visite cliente o assegnazioni operative finché non vengono confermate.
- Tenere separati i rifiuti dai conteggi del servizio e dallo storico di affidabilità; preservare sincronizzazione, audit, cestino, stampe e backup.

## 3. Posta del ristorante
- Aggiungere host, porta, sicurezza, nome mittente, email/username e password SMTP protetta, mai restituita alla schermata.
- Consentire SMTP personalizzato oppure il servizio predefinito selezionabile tra **Resend** e **Email Lovable**.
- Il pulsante di prova invia soltanto all’indirizzo dell’operatore autenticato, con esito esplicito.
- Inviare tre messaggi: richiesta ricevuta e in attesa, conferma con riepilogo, rifiuto con motivazione.
- Un errore email non annulla la prenotazione o l’approvazione: viene segnalato senza dichiarare che il messaggio sia stato inviato.

## Prerequisiti dell’invio reale
- SMTP richiede credenziali valide e una connessione cifrata verificata sul servizio pubblicato; il funzionamento locale non basta a provarlo.
- Resend richiede una chiave privata e un mittente verificato; Email Lovable richiede un dominio di proprietà configurato.
- Se il server SMTP scelto non è raggiungibile in modo sicuro dall’app, servirà un collegamento esterno compatibile, da definire prima di attivare l’invio. Non sostituire SMTP silenziosamente con un altro servizio.
- Nessuna pubblicazione automatica: l’aggiornamento online avverrà solo su richiesta.

## Dettagli tecnici
- Controlli atomici e blocchi per ristorante per inserimento e approvazione; autorizzazioni verificate lato server.
- Disponibilità pubblica esclusivamente aggregata, senza esporre clienti, tavoli o credenziali.
- Connessioni SMTP limitate a TLS/STARTTLS e destinazioni pubbliche approvate, con timeout e protezioni dagli abusi.
- Riutilizzare assegnazione intelligente, isolamento tenant e sottoscrizione Realtime esistenti.

## Verifica e rilascio
- Test su capienza residua, limite comitiva, stati, conflitti concorrenti e isolamento tra ristoranti.
- Verifica completa: richiesta pubblica → avviso in agenda → accettazione con tavolo oppure rifiuto → rilettura del risultato.
- Verifica email reale solo dopo configurazione dei mittenti; indicare chiaramente ciò che resta non verificato.
- Aggiornare versione con suffisso **-alpha**, novità e attività completate.