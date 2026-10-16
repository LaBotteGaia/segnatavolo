/** Registro dei rilasci di Segnatavolo (il più recente in cima). Restare su "-alpha" finché non si passa alla beta. */
export type Release = { version: string; date: string; items: string[] };

export const CHANGELOG: Release[] = [
  {
    version: "v0.7.0-alpha",
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
