import { createFileRoute, Navigate } from "@tanstack/react-router";
import { RestaurantGate } from "@/components/RestaurantGate";
import { useMembership } from "@/lib/membership";
import { SpacesEditor } from "@/components/settings/SpacesEditor";

export const Route = createFileRoute("/_authenticated/sale")({
  head: () => ({
    meta: [
      { title: "Gestione Sale — Segnatavolo" },
      { name: "description", content: "Crea le sale e disponi i tavoli sulla mappa." },
      { property: "og:title", content: "Gestione Sale — Segnatavolo" },
      { property: "og:description", content: "Crea le sale e disponi i tavoli sulla mappa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RestaurantGate>
      <MasterOnly />
    </RestaurantGate>
  ),
});

function MasterOnly() {
  const { data: me } = useMembership();
  if (me?.role !== "master") return <Navigate to="/agenda" />;
  return <SpacesEditor />;
}
