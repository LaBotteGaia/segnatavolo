import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/agenda" });
  },
  head: () => ({
    meta: [
      { title: "Segnatavolo — La tua agenda ristorante" },
      { name: "description", content: "Accedi all’agenda Segnatavolo per gestire prenotazioni, tavoli e servizi del tuo ristorante." },
      { property: "og:title", content: "Segnatavolo — La tua agenda ristorante" },
      { property: "og:description", content: "Accedi all’agenda Segnatavolo per gestire prenotazioni, tavoli e servizi del tuo ristorante." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
