import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, LockKeyhole, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OPERATIONAL_ROLES, passwordError } from "@/lib/operator-profile";
import { ownRestaurantId, scopeRestaurant } from "@/lib/tenant";
import { roleLabel, type Member } from "@/lib/membership";

export function OperatorProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const profile = useQuery({
    queryKey: ["own-operator-profile"], enabled: open, staleTime: 0,
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Accesso non disponibile");
      const { data, error } = await scopeRestaurant(supabase.from("restaurant_members").select("*"), await ownRestaurantId()).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
      if (error) throw error;
      return { member: data, email: auth.user.email ?? "" };
    },
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>Il Mio Profilo</DialogTitle></DialogHeader>
    {profile.isPending ? <div role="status" className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" /> Caricamento profilo…</div> : profile.isError ? <div role="alert">Profilo non disponibile. <Button variant="outline" onClick={() => profile.refetch()}>Riprova</Button></div> : <>
      {profile.data?.member ? <ProfileForm key={`${profile.data.member.id}-${profile.dataUpdatedAt}`} member={profile.data.member} email={profile.data.email} /> : <div><Label>Email</Label><Input readOnly value={profile.data?.email ?? ""} /><p className="mt-2 text-sm text-muted-foreground">Nessun profilo di sala associato a questo account.</p></div>}
      <PasswordForm />
    </>}
  </DialogContent></Dialog>;
}

function ProfileForm({ member, email }: { member: Member; email: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [notes, setNotes] = useState(member.notes);
  const [job, setJob] = useState(member.operational_role || "unspecified");
  const [busy, setBusy] = useState(false);
  return <form className="space-y-3" onSubmit={async (e) => {
    e.preventDefault(); if (busy || !name.trim()) return; setBusy(true);
    try {
      const { error } = await supabase.rpc("update_operator_profile", { _name: name.trim(), _phone: phone.trim(), _notes: notes.trim(), _operational_role: job === "unspecified" ? "" : job });
      if (error) throw error;
      await Promise.all(["own-operator-profile", "membership", "members"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      toast.success("Profilo operatore aggiornato");
    } catch { toast.error("Impossibile salvare il profilo. Riprova."); } finally { setBusy(false); }
  }}>
    <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Anagrafica operatore interno</h3><span className="text-xs text-muted-foreground">{roleLabel(member.role)}</span></div>
    <div><Label htmlFor="profile-name">Nome e Cognome / Nickname di sala</Label><Input id="profile-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
    <div><Label htmlFor="profile-job">Ruolo operativo</Label><Select value={job} onValueChange={setJob}><SelectTrigger id="profile-job"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unspecified">Non specificato</SelectItem>{Array.from(new Set([...OPERATIONAL_ROLES, ...(job === "unspecified" ? [] : [job])])).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
    <div><Label htmlFor="profile-email">Indirizzo Email</Label><Input id="profile-email" type="email" readOnly value={email} className="bg-muted" /></div>
    <div><Label htmlFor="profile-phone">Recapito Telefonico Personale / Servizio</Label><Input id="profile-phone" type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
    <div><Label htmlFor="profile-notes">Note operative / Disponibilità</Label><Textarea id="profile-notes" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={busy || !name.trim()}>{busy ? <LoaderCircle className="animate-spin" /> : <Save />}{busy ? "Salvataggio…" : "Salva profilo"}</Button>
  </form>;
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <form className="space-y-3 border-t pt-4" onSubmit={async (e) => {
    e.preventDefault(); if (busy) return;
    const invalid = passwordError(password, confirmation); setError(invalid); if (invalid) return;
    setBusy(true);
    try {
      const { error: failure } = await supabase.auth.updateUser({ password, ...(current ? { current_password: current } : {}) });
      if (failure) {
        const message = failure.code === "same_password" ? "Scegli una password diversa da quella attuale" : failure.code === "weak_password" ? "Password non abbastanza sicura. Scegli una password più robusta." : "Password non aggiornata. Verifica la password attuale o accedi nuovamente e riprova.";
        setError(message); toast.error(message); return;
      }
      setCurrent(""); setPassword(""); setConfirmation("");
      toast.success("Password aggiornata con successo.");
    } catch { setError("Connessione non disponibile. Riprova."); } finally { setBusy(false); }
  }}>
    <h3 className="flex items-center gap-2 font-semibold"><LockKeyhole className="size-4" /> Sicurezza Account / Cambia Password</h3>
    <div><Label htmlFor="current-password">Password attuale (se richiesta)</Label><Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
    <div><Label htmlFor="new-password">Nuova Password</Label><Input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
    <div><Label htmlFor="confirm-password">Conferma Nuova Password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}{busy ? "Aggiornamento…" : "Aggiorna password"}</Button>
  </form>;
}