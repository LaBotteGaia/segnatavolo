import { useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppMenu } from "@/components/AppMenu";
import { setAssist, useIsSuperAdmin } from "@/lib/assist";
import { backupFileName, downloadJson } from "@/lib/backup";
import { DeleteRestaurantDialog, ImportDialog, RestoreDialog, StaffDialog, type AdminMember } from "@/components/admin/AdminDialogs";

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

type RestaurantRow = { id: string; name: string; created_at: string; rooms: number; staff: number; members: AdminMember[] };
type Target = { id: string; name: string };

function AdminPage() {
  const { data: isSuperAdmin, isLoading: checking } = useIsSuperAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [restoreT, setRestoreT] = useState<Target | null>(null);
  const [staffT, setStaffT] = useState<Target | null>(null);
  const [deleteT, setDeleteT] = useState<Target | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-restaurants"],
    enabled: isSuperAdmin === true,
    queryFn: async (): Promise<RestaurantRow[]> => {
      const [{ data: restaurants, error: e1 }, { data: rooms, error: e2 }, { data: members, error: e3 }] = await Promise.all([
        supabase.from("restaurants").select("id, name, created_at").order("created_at", { ascending: false }),
        supabase.from("rooms").select("id, restaurant_id"),
        supabase.from("restaurant_members").select("id, user_id, name, email, role, restaurant_id").eq("status", "active").order("name"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      const roomCount = new Map<string, number>();
      for (const r of rooms ?? []) if (r.restaurant_id) roomCount.set(r.restaurant_id, (roomCount.get(r.restaurant_id) ?? 0) + 1);
      const byRest = new Map<string, AdminMember[]>();
      for (const m of members ?? []) byRest.set(m.restaurant_id, [...(byRest.get(m.restaurant_id) ?? []), m]);
      return (restaurants ?? []).map((r) => ({ id: r.id, name: r.name, created_at: r.created_at, rooms: roomCount.get(r.id) ?? 0, staff: byRest.get(r.id)?.length ?? 0, members: byRest.get(r.id) ?? [] }));
    },
  });

  if (checking) return <div className="flex min-h-screen items-center justify-center font-hand text-xl text-primary-foreground">Caricamento…</div>;
  if (!isSuperAdmin) return <Navigate to="/agenda" replace />;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-restaurants"] });

  const enter = (r: RestaurantRow) => {
    setAssist({ id: r.id, name: r.name });
    qc.clear();
    navigate({ to: "/agenda" });
  };

  const exportBackup = async (r: RestaurantRow) => {
    setExporting(r.id);
    const { data, error } = await supabase.rpc("export_restaurant_data", { _restaurant_id: r.id });
    setExporting(null);
    if (error || !data) return toast.error(`Backup non riuscito: ${error?.message ?? "nessun dato"}`);
    downloadJson(data, backupFileName(r.name));
    toast.success("Backup scaricato");
  };

  const staffMembers = rows?.find((r) => r.id === staffT?.id)?.members ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/agenda" })}>
          <ArrowLeft className="size-4" /> Torna all'agenda
        </Button>
        <h1 className="flex-1 text-center font-display text-xl text-primary">🛠️ Pannello Admin — Assistenza Piattaforma</h1>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>📥 Importa Ristorante da Backup</Button>
        <AppMenu />
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <p className="mb-4 text-sm text-muted-foreground">
          Elenco dei ristoranti registrati. Con "Accedi come Assistenza" vedi e correggi l'app con gli occhi del locale selezionato.
        </p>
        {isLoading && <p className="py-10 text-center font-hand text-xl text-muted-foreground">Caricamento ristoranti…</p>}
        <div className="space-y-3">
          {(rows ?? []).map((r) => (
            <div key={r.id} className="paper-page rounded-md p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" disabled={exporting === r.id} onClick={() => exportBackup(r)}>
                  {exporting === r.id && <Loader2 className="size-4 animate-spin" />} 💾 Scarica Backup (.json)
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRestoreT(r)}>🔄 Ripristina da Backup</Button>
                <Button size="sm" variant="outline" onClick={() => setStaffT(r)}>👥 Staff & Utenti ({r.staff})</Button>
                <Button size="sm" variant="destructive" className="sm:ml-auto" onClick={() => setDeleteT(r)}>🗑️ Elimina Ristorante</Button>
              </div>
            </div>
          ))}
          {rows && rows.length === 0 && <p className="py-10 text-center text-muted-foreground">Nessun ristorante registrato.</p>}
        </div>
      </main>
      <RestoreDialog target={restoreT} onClose={() => setRestoreT(null)} onDone={refresh} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={refresh} />
      <StaffDialog target={staffT} members={staffMembers} onClose={() => setStaffT(null)} onDone={refresh} />
      <DeleteRestaurantDialog target={deleteT} onClose={() => setDeleteT(null)} onDone={refresh} />
    </div>
  );
}
