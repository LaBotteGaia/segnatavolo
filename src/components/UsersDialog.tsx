import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteLink, roleLabel, type Invite, type Member, type Role } from "@/lib/membership";

const copy = async (token: string) => {
  await navigator.clipboard.writeText(inviteLink(token));
  toast.success("Link invito copiato");
};

export function UsersDialog({ open, onOpenChange, me }: { open: boolean; onOpenChange: (o: boolean) => void; me: Member }) {
  const qc = useQueryClient();
  const members = useQuery({
    queryKey: ["members"],
    enabled: open,
    queryFn: async () => (await supabase.from("restaurant_members").select("*").order("created_at")).data as Member[],
  });
  const invites = useQuery({
    queryKey: ["invites"],
    enabled: open,
    queryFn: async () =>
      (await supabase.from("restaurant_invites").select("*").is("accepted_at", null).order("created_at")).data as Invite[],
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["invites"] });
  };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [lastToken, setLastToken] = useState<string | null>(null);

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Inserisci il nome o nickname di sala"); return; }
    const { data, error } = await supabase
      .from("restaurant_invites")
      .insert({ restaurant_id: me.restaurant_id, name: name.trim(), email: email.trim().toLowerCase(), role })
      .select()
      .single();
    if (error || !data) { toast.error("Impossibile creare l'invito"); return; }
    setLastToken(data.token);
    setName("");
    setEmail("");
    refresh();
  };

  const act = async (p: PromiseLike<{ error: unknown }>) => {
    const { error } = await p;
    if (error) toast.error("Operazione non riuscita");
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">Gestione Utenti e Inviti</DialogTitle>
        </DialogHeader>

        <section className="space-y-3 rounded-md border p-4">
          <h3 className="font-semibold">Invita nuovo utente</h3>
          <form onSubmit={createInvite} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label htmlFor="in">Nome o Nickname di Sala</Label>
              <Input id="in" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ie">Email</Label>
              <Input id="ie" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Ruolo</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff Sala</SelectItem>
                  <SelectItem value="master">Co-Master/Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="sm:col-span-3">Crea Invito</Button>
          </form>
          {lastToken && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{inviteLink(lastToken)}</span>
              <Button size="sm" variant="secondary" onClick={() => copy(lastToken)}>📋 Copia Link Invito</Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Invia il link al collaboratore via WhatsApp o email: aprendolo imposterà la sua password.</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Utenti e inviti</h3>
          {members.data?.map((m) => {
            const self = m.user_id === me.user_id;
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{m.name || "—"} {self && <span className="text-muted-foreground">(tu)</span>}</div>
                  <div className="truncate text-muted-foreground">{m.email}</div>
                </div>
                <span className={m.status === "active" ? "text-primary" : "text-destructive"}>{m.status === "active" ? "Attivo" : "Sospeso"}</span>
                {self ? (
                  <span className="w-24 text-right">{roleLabel(m.role)}</span>
                ) : (
                  <>
                    <Select value={m.role} onValueChange={(v) => act(supabase.from("restaurant_members").update({ role: v }).eq("id", m.id))}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="master">Master</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => act(supabase.from("restaurant_members").update({ status: m.status === "active" ? "suspended" : "active" }).eq("id", m.id))}>
                      {m.status === "active" ? "Sospendi" : "Riattiva"}
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Rimuovi" onClick={() => confirm(`Rimuovere ${m.name || m.email} dal ristorante?`) && act(supabase.from("restaurant_members").delete().eq("id", m.id))}>
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
          {invites.data?.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{i.name || "—"}</div>
                <div className="truncate text-muted-foreground">{i.email}</div>
              </div>
              <span className="text-muted-foreground">Invito in attesa · {roleLabel(i.role)}</span>
              <Button size="sm" variant="secondary" onClick={() => copy(i.token)}><Copy /> Copia</Button>
              <Button size="sm" variant="ghost" onClick={() => act(supabase.from("restaurant_invites").delete().eq("id", i.id))}>Revoca</Button>
            </div>
          ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}
