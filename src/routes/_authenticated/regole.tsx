import { createFileRoute, redirect } from "@tanstack/react-router";

/** Pagina storica: le regole di assegnazione vivono nella Configurazione Ristorante. */
export const Route = createFileRoute("/_authenticated/regole")({
  beforeLoad: () => { throw redirect({ to: "/settings", search: { tab: "regole" } }); },
});
