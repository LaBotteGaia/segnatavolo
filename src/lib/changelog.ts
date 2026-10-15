/** Registro dei rilasci di Segnatavolo (il più recente in cima). Restare su "-alpha" finché non si passa alla beta. */
export type Release = { version: string; date: string; items: string[] };

export const CHANGELOG: Release[] = [
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
