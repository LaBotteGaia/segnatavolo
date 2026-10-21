import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppMenu } from "@/components/AppMenu";
import { setAssist, useIsSuperAdmin } from "@/lib/assist";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Pannello Admin — Segnatavolo" },
      { name: "description", content: "Pannello riservato all'assistenza piattaforma Segnatavolo." },
      { property: "og:title", content: "Pannello Admin — Segnatavolo" },
      { property: "og:description", content: "Pannello riservato all'assistenza piattaforma Segnatavolo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type RestaurantRow = { id: string; name: string; created_at: string; rooms: number; staff: number };

function AdminPage() {
  const { data: isSuperAdmin, isLoading: checking } = useIsSuperAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-restaurants"],
    enabled: isSuperAdmin === true,
    queryFn: async (): Promise<RestaurantRow[]> => {
      const [{ data: restaurants, error: e1 }, { data: rooms, error: e2 }, { data: members, error: e3 }] = await Promise.all([
        supabase.from("restaurants").select("id, name, created_at").order("created_at", { ascending: false }),
        supabase.from("rooms").select("id, restaurant_id"),
        supabase.from("restaurant_members").select("id, restaurant_id").eq("status", "active"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      const roomCount = new Map<string, number>();
      for (const r of rooms ?? []) roomCount.set(r.restaurant_id, (roomCount.get(r.restaurant_id) ?? 0) + 1);
      const staffCount = new Map<string, number>();
      for (const m of members ?? []) staffCount.set(m.restaurant_id, (staffCount.get(m.restaurant_id) ?? 0) + 1);
      return (restaurants ?? []).map((r) => ({ id: r.id, name: r.name, created_at: r.created_at, rooms: roomCount.get(r.id) ?? 0, staff: staffCount.get(r.id) ?? 0 }));
    },
  });

  if (checking) return <div className="flex min-h-screen items-center justify-center font-hand text-xl text-primary-foreground">Caricamento…</div>;
  if (!isSuperAdmin) return <Navigate to="/agenda" replace />;

  const enter = (r: RestaurantRow) => {
    setAssist({ id: r.id, name: r.name });
    qc.clear();
    navigate({ to: "/agenda" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/agenda" })}>
          <ArrowLeft className="size-4" /> Torna all'agenda
        </Button>
        <h1 className="flex-1 text-center font-display text-xl text-primary">🛠️ Pannello Admin — Assistenza Piattaforma</h1>
        <AppMenu />
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <p className="mb-4 text-sm text-muted-foreground">
          Elenco dei ristoranti registrati. Con "Accedi come Assistenza" vedi e correggi l'app con gli occhi del locale selezionato.
        </p>
        {isLoading && <p className="py-10 text-center font-hand text-xl text-muted-foreground">Caricamento ristoranti…</p>}
        <div className="space-y-3">
          {(rows ?? []).map((r) => (
            <div key={r.id} className="paper-page flex flex-col gap-3 rounded-md p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg text-primary">{r.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Registrato il {format(parseISO(r.created_at), "d MMMM yyyy", { locale: it })} · {r.rooms} {r.rooms === 1 ? "sala" : "sale"} · {r.staff} {r.staff === 1 ? "membro attivo" : "membri attivi"}
                </div>
              </div>
              <Button onClick={() => enter(r)} className="shrink-0 bg-amber-500 font-bold text-amber-950 hover:bg-amber-400">
                <Wrench className="size-4" /> Accedi come Assistenza
              </Button>
            </div>
          ))}
          {rows && rows.length === 0 && <p className="py-10 text-center text-muted-foreground">Nessun ristorante registrato.</p>}
        </div>
      </main>
    </div>
  );
}
