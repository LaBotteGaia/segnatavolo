import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite } from "@/lib/invites.functions";
import { roleLabel } from "@/lib/membership";

export const Route = createFileRoute("/invito/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Invito staff — Agenda Prenotazioni" },
      { name: "description", content: "Completa la registrazione con il tuo invito." },
      { property: "og:title", content: "Invito staff — Agenda Prenotazioni" },
      { property: "og:description", content: "Completa la registrazione con il tuo invito." },
    ],
  }),
  component: InvitePage,
});

type Inv = { name: string; email: string; role: string; restaurant_name: string };

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState<Inv | null | undefined>(undefined);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc("get_invite", { _token: token }).then(({ data }) => setInv((data as Inv[] | null)?.[0] ?? null));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await acceptInvite({ data: { token, password: pw } });
    if (!res.ok) {
      setBusy(false);
      toast.error(res.error); return;
    }
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email: res.email, password: pw });
    setBusy(false);
    if (error) return navigate({ to: "/auth" });
    navigate({ to: "/agenda" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="paper-page w-full max-w-sm rounded-md py-10 pl-14 pr-8">
        {inv === undefined && <p className="font-hand text-lg">Verifica invito…</p>}
        {inv === null && (
          <>
            <h1 className="font-display text-2xl text-primary">Invito non valido</h1>
            <p className="mt-2 text-muted-foreground">Il link è scaduto, revocato o già usato. Chiedi un nuovo invito all'Account Master.</p>
          </>
        )}
        {inv && (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="font-display text-2xl text-primary">{inv.restaurant_name}</h1>
            <p className="font-hand text-lg text-muted-foreground">Ciao {inv.name}, sei stato invitato come {roleLabel(inv.role)}.</p>
            <div>
              <Label>Email</Label>
              <Input value={inv.email} disabled />
            </div>
            <div>
              <Label htmlFor="pw">Scegli una password</Label>
              <Input id="pw" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>Completa registrazione</Button>
          </form>
        )}
      </div>
    </div>
  );
}
