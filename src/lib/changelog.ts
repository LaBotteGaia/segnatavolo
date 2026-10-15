/** Registro dei rilasci di Segnatavolo (il più recente in cima). Restare su "-alpha" finché non si passa alla beta. */
export type Release = { version: string; date: string; items: string[] };

export const CHANGELOG: Release[] = [
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
