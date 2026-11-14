import { createFileRoute, redirect } from "@tanstack/react-router";

/** Pagina storica: la gestione sale vive nella Configurazione Ristorante. */
export const Route = createFileRoute("/_authenticated/sale")({
  beforeLoad: () => { throw redirect({ to: "/settings", search: { tab: "spazi" } }); },
});
