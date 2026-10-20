import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperatorName } from "@/components/OperatorName";
import { useMembership } from "@/lib/membership";

export function RestaurantGate({ children }: { children: ReactNode }) {
  const { data: m, isLoading } = useMembership();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center font-hand text-xl text-primary-foreground">Caricamento…</div>;
  if (!m) return <CreateRestaurant />;
  if (m.status !== "active")
    return (
      <Shell>
        <h1 className="font-display text-2xl text-primary">Accesso sospeso</h1>
        <p className="my-4 text-muted-foreground">Il tuo accesso a {m.restaurants?.name ?? "questo ristorante"} è stato sospeso dall'Account Master.</p>
        <Button onClick={() => supabase.auth.signOut()}>Esci</Button>
      </Shell>
    );
  if (!m.name.trim()) return <Shell><h1 className="mb-4 font-display text-2xl text-primary">Il tuo nome di sala</h1><OperatorName /></Shell>;
  return <>{children}</>;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="paper-page w-full max-w-md rounded-md py-10 pl-14 pr-8">{children}</div>
    </div>
  );
}

function CreateRestaurant() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [me, setMe] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !me.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_restaurant", { _name: name, _display_name: me });
    setBusy(false);
    if (error) { toast.error("Impossibile creare il ristorante"); return; }
    qc.invalidateQueries();
  };
  return (
    <Shell>
      <form onSubmit={submit} className="space-y-4">
        <h1 className="font-display text-2xl text-primary">Crea il tuo ristorante</h1>
        <p className="font-hand text-lg text-muted-foreground">Diventerai l'Account Master. Se invece lavori in un ristorante esistente, chiedi un link di invito al Master.</p>
        <div>
          <Label htmlFor="rn">Nome del ristorante</Label>
          <Input id="rn" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="mn">Nome o Nickname di Sala</Label>
          <Input id="mn" required value={me} onChange={(e) => setMe(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>Crea ristorante</Button>
        <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => supabase.auth.signOut()}>Esci</button>
      </form>
    </Shell>
  );
}
