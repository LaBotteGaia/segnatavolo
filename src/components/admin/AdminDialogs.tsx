import { useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateBackup, type BackupSummary } from "@/lib/backup";
import { supabase } from "@/integrations/supabase/client";

const errMsg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Operazione non riuscita");

function FileDrop({ onLoaded }: { onLoaded: (data: unknown, summary: BackupSummary) => void }) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const read = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const v = validateBackup(data);
      if (!v.ok) return setError(v.error);
      setError(null);
      onLoaded(data, v.summary);
    } catch {
      setError("Il file non è un JSON leggibile.");
    }
  };
  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); read(e.dataTransfer.files[0]); }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center text-sm ${drag ? "border-primary bg-accent" : "border-border"}`}
      >
        <Upload className="size-6 text-muted-foreground" />
        Trascina qui il file .json oppure tocca per sceglierlo
        <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
      </label>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Summary({ s }: { s: BackupSummary }) {
  return (
    <div className="rounded-md bg-muted p-3 text-sm">
      {s.restaurantName && <div><b>Ristorante:</b> {s.restaurantName}</div>}
      <div><b>Data backup:</b> {s.exportedAt ? format(parseISO(s.exportedAt), "d MMMM yyyy, HH:mm", { locale: it }) : "non indicata"}</div>
      <div>{s.rooms} sale · {s.tables} tavoli · {s.reservations} prenotazioni · {s.customers} clienti</div>
    </div>
  );
}

export function RestoreDialog({ target, onClose, onDone }: { target: { id: string; name: string } | null; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<{ data: unknown; summary: BackupSummary } | null>(null);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { setFile(null); setWord(""); onClose(); };
  const run = async () => {
    if (!target || !file) return;
    setBusy(true);
    const { error } = await supabase.rpc("restore_restaurant_data", { _target_restaurant_id: target.id, _backup_data: file.data as never });
    setBusy(false);
    if (error) return toast.error(`Ripristino annullato: ${errMsg(error)}`);
    toast.success(`Ripristino completato per ${target.name}`);
    onDone();
    close();
  };
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🔄 Ripristina da Backup — {target?.name}</DialogTitle>
          <DialogDescription>Carica un file di backup Segnatavolo (.json).</DialogDescription>
        </DialogHeader>
        {!file ? <FileDrop onLoaded={(data, summary) => setFile({ data, summary })} /> : (
          <div className="space-y-3">
            <Summary s={file.summary} />
            <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              ATTENZIONE: Il ripristino sovrascriverà l'attuale configurazione di sale, tavoli e prenotazioni con i dati presenti nel file di backup.
            </p>
            <div className="space-y-1">
              <Label htmlFor="restore-word">Scrivi RIPRISTINA per confermare</Label>
              <Input id="restore-word" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFile(null)} disabled={busy}>Scegli un altro file</Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>Annulla</Button>
          <Button variant="destructive" disabled={!file || word !== "RIPRISTINA" || busy} onClick={run}>
            {busy && <Loader2 className="size-4 animate-spin" />} Ripristina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<{ data: unknown; summary: BackupSummary } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { setFile(null); setName(""); onClose(); };
  const run = async () => {
    if (!file) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_restaurant_from_backup", { _name: name.trim(), _backup_data: file.data as never });
    setBusy(false);
    if (error) return toast.error(`Importazione annullata: ${errMsg(error)}`);
    toast.success(`Ristorante "${name.trim()}" creato dal backup`);
    onDone();
    close();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>📥 Importa Ristorante da Backup</DialogTitle>
          <DialogDescription>Crea un nuovo ristorante con sale, tavoli, clienti e prenotazioni del file. Lo staff non viene copiato: invitalo dopo.</DialogDescription>
        </DialogHeader>
        {!file ? <FileDrop onLoaded={(data, summary) => { setFile({ data, summary }); setName(summary.restaurantName); }} /> : (
          <div className="space-y-3">
            <Summary s={file.summary} />
            <div className="space-y-1">
              <Label htmlFor="import-name">Nome del nuovo ristorante</Label>
              <Input id="import-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFile(null)} disabled={busy}>Scegli un altro file</Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>Annulla</Button>
          <Button disabled={!file || !name.trim() || busy} onClick={run}>
            {busy && <Loader2 className="size-4 animate-spin" />} Crea ristorante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type AdminMember = { id: string; user_id: string; name: string; email: string; role: string; restaurant_id: string };

export function StaffDialog({ target, members, onClose, onDone }: { target: { id: string; name: string } | null; members: AdminMember[]; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ m: AdminMember; full: boolean } | null>(null);
  const run = async () => {
    if (!confirm || !target) return;
    setBusy(confirm.m.user_id);
    const { error } = await supabase.rpc("delete_restaurant_user", { _user_id: confirm.m.user_id, _restaurant_id: target.id, _delete_from_auth: confirm.full });
    setBusy(null);
    if (error) return toast.error(errMsg(error));
    toast.success(confirm.full ? "Utente eliminato definitivamente" : "Utente rimosso dal locale");
    setConfirm(null);
    onDone();
  };
  return (
    <>
      <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>👥 Staff & Utenti — {target?.name}</DialogTitle>
            <DialogDescription>{members.length} {members.length === 1 ? "utente collegato" : "utenti collegati"}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {members.map((m) => (
              <div key={m.id} className="rounded-md border p-3">
                <div className="font-semibold">{m.name || "—"} <span className="text-xs font-normal text-muted-foreground">· {m.role === "master" ? "Master" : "Staff"}</span></div>
                <div className="truncate text-sm text-muted-foreground">{m.email}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setConfirm({ m, full: false })}>Rimuovi da questo locale</Button>
                  <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => setConfirm({ m, full: true })}>Elimina Utente (Definitivo)</Button>
                </div>
              </div>
            ))}
            {members.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nessun utente collegato.</p>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirm} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.full ? "Eliminare definitivamente l'utente?" : "Rimuovere l'utente dal locale?"}</DialogTitle>
            <DialogDescription>
              {confirm?.full
                ? `${confirm.m.email}: l'account di accesso verrà cancellato e non potrà più entrare. Le prenotazioni restano con il suo nome nell'audit.`
                : `${confirm?.m.email} non avrà più accesso a ${target?.name}. L'account di accesso resta.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={!!busy}>Annulla</Button>
            <Button variant="destructive" onClick={run} disabled={!!busy}>{busy && <Loader2 className="size-4 animate-spin" />} Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteRestaurantDialog({ target, onClose, onDone }: { target: { id: string; name: string } | null; onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { setTyped(""); onClose(); };
  const run = async () => {
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_restaurant_cascade", { _restaurant_id: target.id });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(`${target.name} eliminato`);
    onDone();
    close();
  };
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🗑️ Elimina Ristorante</DialogTitle>
          <DialogDescription>
            Operazione irreversibile: verranno cancellati sale, tavoli, clienti, prenotazioni, note, inviti e collegamenti dello staff di <b>{target?.name}</b>. Scarica prima un backup se ti serve.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="del-name">Scrivi esattamente il nome del ristorante per confermare</Label>
          <Input id="del-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={target?.name} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>Annulla</Button>
          <Button variant="destructive" disabled={!target || typed !== target.name || busy} onClick={run}>
            {busy && <Loader2 className="size-4 animate-spin" />} Elimina definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
