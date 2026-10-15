import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/agenda" });
  },
  head: () => ({
    meta: [
      { title: "Segnatavolo" },
      { name: "description", content: "Agenda interna delle prenotazioni del ristorante." },
      { property: "og:title", content: "Segnatavolo" },
      { property: "og:description", content: "Agenda interna delle prenotazioni del ristorante." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
