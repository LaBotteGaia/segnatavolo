/** Registro dei rilasci di Segnatavolo (il più recente in cima). Restare su "-alpha" finché non si passa alla beta. */
export type Release = { version: string; date: string; items: string[] };

export const CHANGELOG: Release[] = [
  { version:'v0.8.14-alpha',date:'24 ottobre 2026',items:['Sala Live riprogettata a due colonne: a sinistra la gestione arrivi con spunta sincronizzata con l’agenda (sezioni In Arrivo e Arrivati/Seduti, nome completo, tavolo, coperti, orario e note), a destra la griglia ordinata dei tavoli.','Griglia tavoli ordinata per sala e numero con sale chiuse nascoste: ogni riquadro mostra numero, sala, capienza e stato (Libero, Seduti da X min, In arrivo); tocco su libero per accomodare al volo, su occupato per spostare o accomodare una nuova comitiva.','Controlli di zoom −/100%/+ sulla griglia e tocco sulla prenotazione in colonna per mettere a fuoco il tavolo corrispondente.'] },
  { version:'v0.8.13-alpha',date:'24 ottobre 2026',items:['Modalità Sala Live: schermata a tutto schermo solo orizzontale con mappa dei tavoli in tempo reale (liberi, occupati con tempi di seduta, in arrivo), contatori e tab delle sale.','Spostamento rapido di una comitiva toccando il tavolo di destinazione e scambio tavoli con un tocco quando la destinazione è occupata.','Accomoda al volo anche su tavoli ancora segnati occupati: conferma a un tocco, uscita della comitiva precedente registrata all’orario attuale e nuovo tavolo aperto all’istante.'] },
  { version:'v0.8.12-alpha',date:'24 ottobre 2026',items:['Anteprima delle regole riconosciute con condizioni, azioni e salvaguardia: conferma esplicita, modifica manuale e scarto senza salvataggio automatico.','Mappa planimetrica dei tavoli con coordinate e pareti salvate, tab sale, zoom e trascinamento touch, consigliati evidenziati e raccordi delle unioni; lista alternativa.'] },
  { version:'v0.8.11-alpha',date:'24 ottobre 2026',items:['Regole di Assegnazione Sala riservate Master: sedute lunghe e salvaguardia dei tavoli componibili, impostabili manualmente o con bozza Gemini da verificare.','Tavoli isola non accoppiabili e adatti a seduta lunga, con controlli sulle assegnazioni e protezione delle configurazioni.','Selettore tavoli a schede con zona, doppia capienza, suggerimenti, unioni e occupati non forzabili; mappa sala ancora disponibile.'] },
  { version: "v0.8.10-alpha", date: "22 ottobre 2026", items: ["Riorganizzazione automatica della sala: pulsante 🪄 a fondo turno con anteprima degli spostamenti e applicazione su conferma.", "Tavoli a doppia capienza (coperti comodi e massimi), posti scomodi attivi solo in unione e ordine di riempimento per sala.", "Lucchetto sulla prenotazione per proteggere il tavolo assegnato dalla riorganizzazione; switch globale in Configurazione Servizio."] },
  { version: "v0.8.9-alpha", date: "22 ottobre 2026", items: ["Calendario: tap singolo per consultare la disponibilità senza cambiare giorno; pressione prolungata di 500 ms o doppio tap rapido per aprire direttamente l’agenda.", "Chiusura del calendario e del riepilogo quando si apre il giorno, con feedback aptico sui dispositivi compatibili."] },
  { version: "v0.8.8-alpha", date: "22 ottobre 2026", items: ["Dettatura: data locale e giorno italiano coerenti, calcolo controllato di domani, dopodomani, giorni della settimana e giorni numerici.", "Senza riferimenti temporali viene usata la data aperta nell’agenda; oggi e stasera restano riferiti alla data odierna."] },
  { version: "v0.8.7-alpha", date: "22 ottobre 2026", items: ["Dettatura Rapida 🎙️ in agenda: ascolto in italiano, testo modificabile prima dell’invio e nuova prenotazione precompilata con tavolo suggerito.", "Integrazione IA per ristorante in Configurazione Servizio: OpenAI o Gemini con chiave propria cifrata e verifica connessione."] },
  { version: "v0.8.6-alpha", date: "22 ottobre 2026", items: ["Suggerimenti tavoli: unioni contigue senza extra fino a 8 persone; oltre 8, prolunghe subordinate e massimo una per tavolo abilitato.", "Email personalizzabili per richiesta, conferma e rifiuto, con segnaposto e notifica al maître; invio subordinato al servizio di posta configurato.", "Campi numerici cancellabili durante la digitazione, con conversione alla perdita del focus.", "Orari web del doppio turno configurabili e raggruppati: esclusi gli intermedi anche all’invio, rispettando durata e pulizia."] },
  { version: "v0.8.5-alpha", date: "22 ottobre 2026", items: ["Disponibilità online per orario e limite comitiva del ristorante, con coperti residui aggiornati.", "Richieste online in attesa: avviso in agenda, accettazione con tavolo suggerito e rifiuto motivato.", "Configurazione posta per ristorante con password protetta e prova all’operatore; gli invii richiedono un servizio configurato."] },
  { version: "v0.8.4-alpha", date: "22 ottobre 2026", items: ["Canale prenotazioni online per locale, inizialmente disabilitato: identificativo univoco, link pubblico e widget iframe.", "Anticipo massimo e chiusura configurabili, capienza controllata alla conferma con sale aperte, doppi turni e margine di riserva.", "Consenso Privacy obbligatorio e marketing facoltativo separato, con data di accettazione; prenotazioni online nell’agenda condivisa."] },
  { version: "v0.8.3-alpha", date: "22 ottobre 2026", items: ["Calendario: due pallini per giorno, 🏠 sale interne e 🌳 sale esterne, nero se tutte chiuse.", "Tipologia Sala Interna / Esterna (Dehors, Veranda) in Gestione Sale.", "Tavolo suggerito automatico nella nuova prenotazione: tavolo esatto, prolunga con sponde, poi unione di tavoli vicini rispettando i vincoli; sempre modificabile a mano."] },
  { version: "v0.8.2-alpha", date: "22 ottobre 2026", items: ["Isolamento rigoroso dei dati operativi sul ristorante attivo, anche per Super Admin.", "Turni, giorni e doppi turni delle sale modificabili indipendentemente dal blocco mappa, con conferma di salvataggio."] },
  {
    version: "v0.8.1-alpha",
    date: "22 ottobre 2026",
    items: [
      "Pannello Super Admin: backup completo di ogni ristorante in un file .json scaricabile.",
      "Ripristino da backup con riepilogo del file, avviso e conferma scrivendo RIPRISTINA; in caso di errore nulla viene modificato.",
      "Importa Ristorante da Backup: crea un nuovo locale partendo da un file esportato.",
      "Staff & Utenti per ristorante: rimozione dal locale o eliminazione definitiva dell'account.",
      "Elimina Ristorante con conferma digitando il nome esatto.",
    ],
  },
  {
    version: "v0.8.0-alpha",
    date: "22 ottobre 2026",
    items: [
      "Menù riorganizzato: Agenda, Rubrica e No-Show, Sala & Servizio, Cestino, gestione struttura e account.",
      "Il Mio Profilo: nome per audit, ruolo operativo, email in sola lettura, telefono e disponibilità; cambio password con conferma e minimo 8 caratteri.",
      "Staff e inviti: contatti telefonici rapidi e ruoli operativi; assistenza filtrata per ristorante.",
      "Accomoda al volo resta esclusivamente nella toolbar Agenda; preservate tutte le logiche di servizio.",
      "Numero di versione v0.8.0-alpha ripristinato su richiesta, senza rimuovere le funzioni dei rilasci successivi.",
    ],
  },
  {
    version: "v0.12.0-alpha",
    date: "21 ottobre 2026",
    items: [
      "Super Admin / Assistenza Piattaforma: nuovo pannello riservato /admin con l'elenco dei ristoranti registrati (nome, data di registrazione, sale e membri attivi).",
      "\"Accedi come Assistenza\": l'amministratore vede e corregge l'agenda, le sale e le prenotazioni del ristorante scelto come se fosse un utente del locale.",
      "Banner fisso arancione in cima a ogni schermata durante l'assistenza, con pulsante \"Torna al Pannello Admin\".",
      "Accesso riservato: solo gli account Super Admin possono aprire il pannello; gli altri vengono riportati all'agenda.",
      "Conservate sincronizzazione, audit, passanti rapidi, cestino, cache offline, privacy, sale e ostacoli.",
    ],
  },
  {
    version: "v0.11.0-alpha",
    date: "21 ottobre 2026",
    items: [
      "Calendario con selettore ☀️ Pranzo / 🌙 Cena e titolo dinamico (es. \"Pranzi di Ottobre 2026\").",
      "Ripristinato il pallino singolo per giorno: mostra solo l'affluenza del turno selezionato (verde < 65%, giallo 65–89%, rosso ≥ 90%, grigio se chiuso).",
      "Nuove regole di \"Doppio Turno\" per sala (Gestione Sale): periodo dell'anno o tutto l'anno, giorni della settimana e turni applicabili; la capienza della sala conta doppia nelle date e turni attivi.",
      "Conservate sincronizzazione, audit, passanti rapidi, cestino, cache offline, privacy, sale e ostacoli.",
    ],
  },
  {
    version: "v0.10.0-alpha",
    date: "21 ottobre 2026",
    items: [
      "Calendario con due indicatori di affluenza per ogni giorno: sinistra Pranzo, destra Cena (verde < 65%, giallo 65–89%, rosso ≥ 90%, grigio se chiuso).",
      "Passando sopra o toccando un indicatore compare il riepilogo, es. \"Pranzo: 28/40 coperti - 70%\".",
      "Capienza calcolata solo sulle sale aperte in quella data e turno (giorni, stagioni e turni disattivati esclusi).",
      "Nuova impostazione \"Coperti di Riserva (Margine di Sala)\" (predefinito 4 posti) sottratta dalla capienza prenotabile.",
    ],
  },
  {
    version: "v0.9.0-alpha",
    date: "21 ottobre 2026",
    items: [
      "Conformità legale e Google Play: link \"Termini di Servizio e Privacy\" nella schermata di accesso e nuova voce \"Informazioni legali e Privacy\" nel menù ☰.",
      "La sezione legale mostra versione dell'app, copyright Osteria La BotteGaia e server dati in Unione Europea (conforme GDPR).",
      "Elimina il mio account operatore (in \"Profilo operatore\"): conferma con avviso chiaro, revoca immediata dell'accesso e uscita automatica; l'audit delle prenotazioni storiche resta conservato.",
      "Un Master non può eliminarsi se è l'unico Master del ristorante: prima va nominato un sostituto.",
      "Conservate sincronizzazione, audit, passanti rapidi, cestino, cache offline, privacy, sale e ostacoli.",
    ],
  },
  {
    version: "v0.8.0-alpha (21 ottobre)",
    date: "21 ottobre 2026",
    items: [
      "Sala & Servizio: un solo pannello per disponibilità tavoli, stampa Foglio di Sala e backup HTML offline del turno selezionato.",
      "Accomoda al volo: coperti e tavolo libero, riferimento facoltativo, ora e turno automatici, già Arrivato con rotazione 90+15 minuti.",
      "ANNULLA immediato per 8 secondi e Cestino del giorno condiviso: ripristino con tavolo originario o avviso se ora occupato.",
      "Conservate sincronizzazione, audit operatore, cache di 60 secondi, privacy, sale e ostacoli.",
    ],
  },
  {
    version: "v0.7.0-alpha",
    date: "20 ottobre 2026",
    items: [
      "Sincronizzazione condivisa di prenotazioni e rubrica con breve evidenziazione delle righe aggiornate.",
      "Avvisi per date o orari trascorsi e prenotazioni oltre sei mesi: presa visione prima di confermare.",
      "Nome o Nickname di Sala obbligatorio e indicazione di chi ha preso e modificato la prenotazione.",
      "Protezione delle micro-disconnessioni: copia locale dell’agenda per un minuto, stato connessione e supporto offline nell’app pubblicata.",
      "Esporta Piano di Sala (Emergenza): file HTML locale, stampabile in bianco e nero, con mappe, tavoli e assegnazioni.",
      "Icone ridondanti rimosse; versione richiesta v0.7.0-alpha senza rimuovere le funzioni già presenti.",
    ],
  },
  {
    version: "v0.9.0-alpha (20 ottobre)",
    date: "20 ottobre 2026",
    items: [
      "Modalità Privacy al banco: i telefoni a schermo appaiono mascherati (es. \"348 ••• ••89\") in agenda, rubrica, ricerca e nuova prenotazione.",
      "Toccando il numero o l'icona 👁️ si svela per 10 secondi; Chiama e WhatsApp usano sempre il numero completo.",
      "In Gestione Ristorante: interruttore della Modalità Privacy (attiva di default) e opzione per stampare i numeri completi sul Foglio di Sala.",
    ],
  },
  {
    version: "v0.8.0-alpha (16 ottobre)",
    date: "16 ottobre 2026",
    items: [
      "Pallino di stato connessione accanto al numero di versione (menù ☰ e fondo agenda): 🟢 verde connesso, 🟡 giallo connessione lenta o in riconnessione, 🔴 rosso disconnesso.",
      "Controllo automatico all'avvio, ogni 60 secondi, quando la finestra torna in primo piano e quando salta/torna internet.",
      "Toccando il pallino si apre il dettaglio \"Stato Connessione Database\" con tempo di risposta in ms, eventuale errore e pulsante \"🔄 Testa connessione adesso\".",
    ],
  },
  {
    version: "v0.7.0-alpha (16 ottobre)",
    date: "16 ottobre 2026",
    items: [
      "Lo swipe per sfogliare l'agenda si disattiva del tutto quando è aperta una finestra (prenotazione, mappa tavoli, cliente, guida) e non scatta mai partendo dalla mappa della sala.",
      "❓ Guida Rapida a carosello in 5 schede (agenda, arrivi, mappa e sponde, rotazione, rubrica): si apre da sola al primo accesso e si riapre dal menù ☰, con pallini, Avanti/Indietro e \"Salta guida\".",
    ],
  },
  {
    version: "v0.6.1-alpha",
    date: "16 ottobre 2026",
    items: [
      "Modificando nome, cognome o telefoni nella scheda cliente si aggiornano subito tutte le sue prenotazioni in agenda e sul Foglio di Sala.",
      "🗑️ Elimina Cliente (solo Master) con avviso di eliminazione definitiva: cancella il cliente e tutte le sue prenotazioni, liberando i tavoli.",
    ],
  },
  {
    version: "v0.6.0-alpha",
    date: "16 ottobre 2026",
    items: [
      "👥 Rubrica Clienti nel menù ☰: ricerca istantanea, ➕ Nuovo Cliente, ordinamento per cognome, nome, visite o ultima visita, indice alfabetico A–Z.",
      "Scheda cliente con Nome e Cognome separati, più telefoni ed email, note fisse/allergie copiate in ogni nuova prenotazione.",
      "Abitudini del cliente: giorno e turno preferiti, mese più frequente, tavolo più assegnato, media coperti, visite e No-Show.",
      "📅 Prenota dalla rubrica apre la nuova prenotazione con il cliente già agganciato.",
      "Form prenotazione più snello: durata, buffer, sponde/barelle, Duplica ed etichette sotto \"⚙️ Mostra opzioni avanzate\".",
    ],
  },
  {
    version: "v0.5.1-alpha",
    date: "16 ottobre 2026",
    items: [
      "In Gestione Sale e Mappe riordini le sale con \"⬆️ Sposta su\" e \"⬇️ Sposta giù\": l'ordine viene salvato e usato in tutta l'app.",
      "I tavoli di ogni sala sono in ordine naturale: prima i numeri (1, 2, 3 … 10, 11), poi lettere e nomi in ordine alfabetico.",
      "Foglio di Sala raggruppato per sala, Situazione Tavoli e scelta tavoli seguono lo stesso ordine.",
    ],
  },
  {
    version: "v0.5.0-alpha",
    date: "15 ottobre 2026",
    items: [
      "Ogni sala si attiva per i singoli turni (Colazione, Pranzo, Cena): ad esempio un dehors aperto a pranzo e chiuso a cena.",
      "Nel turno in cui è chiusa la sala appare \"Chiusa per il turno\", i suoi tavoli non si assegnano e la sua capienza non conta nei pallini del calendario.",
      "Su smartphone sfogli l'agenda col dito: a sinistra avanti (Pranzo → Cena → giorno dopo), a destra indietro, con un rapido effetto pagina.",
      "📊 Situazione Tavoli più compatta, a pillole, e nuovo pulsante \"🖨️ Stampa Situazione\" su un foglio A4 in bianco e nero.",
    ],
  },
  {
    version: "v0.4.0-alpha",
    date: "15 ottobre 2026",
    items: [
      "Spunta Arrivato direttamente sulla riga dell'agenda, con barratura immediata e reversibile.",
      "No-Show automatici dopo la fine del turno e segnalazione manuale dalla scheda prenotazione.",
      "Storico per telefono: visite effettuate, No-Show e ultima mancata presentazione; avvisi non bloccanti in ricerca e nuova prenotazione.",
    ],
  },
  {
    version: "v0.3.1-alpha",
    date: "15 ottobre 2026",
    items: [
      "Su smartphone verticale: Oggi, ricerca e menù sulla prima riga; data grande con frecce sulla seconda, poi Nuova Prenotazione e turni.",
      "Nella vista affiancata e nel Foglio di Sala ogni servizio mostra giorno e mese accanto al turno.",
    ],
  },
  {
    version: "v0.3.0-alpha",
    date: "15 ottobre 2026",
    items: [
      "❄️ Sale stagionali: per ogni sala imposti i giorni di apertura e le chiusure stagionali (es. dehors chiuso dal 1° novembre al 31 marzo).",
      "Nei giorni di chiusura la sala appare \"Chiusa per stagione\" e i suoi tavoli non si assegnano (il Master può forzare).",
      "Il pallino Esterno del calendario diventa grigio quando le sale esterne sono chiuse, e la nuova prenotazione con \"Fuori\" avvisa subito.",
      "⏱️ Rotazione tavoli: durata standard 1h 30m e riallestimento 15 min, modificabili in Gestione Ristorante.",
      "Nella scheda prenotazione scegli 1h 15m, 1h 30m, 1h 45m, 2h o Tutta la sera, e il buffer di pulizia.",
      "Sulla mappa un tavolo torna verde quando si libera; rosso con \"Occupato fino alle…\" o giallo con \"Disponibile fino alle…\".",
      "📊 Situazione Tavoli: elenco liberi/1° turno/2° turno/occupati e planning orario; tocca uno spazio libero per prenotare al volo.",
    ],
  },
  {
    version: "v0.2.0-alpha",
    date: "15 ottobre 2026",
    items: [
      "🚫 Ostacoli sulla mappa: in Gestione Sale e Mappe puoi segnare colonne, pilastri, passaggi o alberi con una X semi-trasparente.",
      "Una casella con ostacolo non può contenere un tavolo e impedisce di unire i tavoli che separa.",
      "La X resta visibile anche nella mappa usata durante il servizio.",
      "📞 Cliente riconosciuto dal numero di telefono: niente più confusione tra omonimi.",
      "Digitando un numero già in archivio il cliente viene agganciato da solo, con visite e ultima presenza.",
      "Con più clienti con lo stesso nome la tendina mostra nome, telefono e ultima visita per scegliere quello giusto.",
      "🆕 Questa finestra delle novità e lo storico delle versioni (tocca il numero di versione).",
    ],
  },
  {
    version: "v0.1.0-alpha",
    date: "ottobre 2026",
    items: [
      "Agenda a doppia pagina Pranzo/Cena, con vista da telefono.",
      "Ristorante condiviso con Master e Staff, inviti tramite link.",
      "Mappe delle sale con pareti, griglia ridimensionabile, sponde e barelle, vincoli di unione tavoli.",
      "Turni, chiusure e ferie; pallini di disponibilità nel calendario.",
      "Scheda prenotazione con Chiama/WhatsApp, Sposta data, Duplica ed Elimina con Annulla.",
      "Ricerca, note di servizio, Foglio di Sala, notifiche ed esportazione dati.",
    ],
  },
];

export const SEEN_VERSION_KEY = "segnatavolo-seen-version";
