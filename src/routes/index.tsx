import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/agenda" });
  },
  head: () => ({
    meta: [
      { title: "Agenda Prenotazioni" },
      { name: "description", content: "Agenda interna delle prenotazioni del ristorante." },
      { property: "og:title", content: "Agenda Prenotazioni" },
      { property: "og:description", content: "Agenda interna delle prenotazioni del ristorante." },
    ],
  }),
});
