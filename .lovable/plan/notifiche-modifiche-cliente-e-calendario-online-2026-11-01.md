# Notifiche, modifiche cliente e calendario online

## Risultato
- **Notifiche:** email al locale per le prenotazioni confermate solo quando viene attivato «Invia email al locale per ogni prenotazione confermata». Inizialmente spento; email al cliente, nuove richieste, modifiche e disdette restano separate.
- **Modifiche cliente:** dal link esistente si possono richiedere nuova data, servizio, orario e coperti scegliendo esclusivamente orari autorizzati. La prenotazione originale e il suo tavolo restano validi mentre la richiesta è in attesa.
- **Agenda:** avviso «Richiesta Modifica Cliente» con confronto prima/dopo, rifiuto motivato e accettazione con assegnazione sicura del tavolo. Il cliente riceve l’esito; se accettata, una nuova conferma aggiornata.
- **Turni online:** per impostazione iniziale ereditano orari, turni e durate generali. Un interruttore esplicito mostra le personalizzazioni riservate all’online.
- **Aperture e chiusure straordinarie:** elenco nelle impostazioni online, aggiunta e rimozione di eccezioni per giorno o intervallo, pranzo/cena/intera giornata e motivo. Il calendario pubblico e il salvataggio rispettano le stesse eccezioni.

## Regole preservate
- Una richiesta di modifica non libera il tavolo né nasconde la prenotazione originaria dall’agenda o dalla Sala Live.
- Le chiusure di un solo servizio non rendono indisponibile l’intero giorno se l’altro servizio è aperto. In caso di eccezioni sovrapposte, la chiusura prevale.
- Un’apertura straordinaria supera il riposo settimanale, non i limiti di capienza, i vincoli di sicurezza, le chiusure meteo o le finestre di anticipo.
- Restano invariati isolamento tra ristoranti, autorizzazioni Master, audit, sincronizzazione e regole di assegnazione.

## Dettagli tecnici
- Modifiche additive allo schema e funzioni database atomiche con blocco per ristorante.
- Stato di modifica in attesa separato dallo stato confermato già utilizzato da agenda, affidabilità e disponibilità.
- Unica configurazione effettiva dei turni e unico controllo delle eccezioni usati da disponibilità, invio iniziale e modifica cliente; nessuna validazione affidata solo alla pagina.
- Riutilizzo del selettore tavoli e del servizio email esistenti; destinatari ricavati dall’evento autorizzato.

## Verifica
- Test mirati su default delle notifiche, ereditarietà/override, eccezioni e conservazione della prenotazione durante la modifica.
- Prova completa con account autorizzato e prenotazione temporanea, senza modificare prenotazioni reali del locale.
- Aggiornamento versione con suffisso `-alpha` e novità. Invio email effettivo verificabile solo con un servizio email funzionante.