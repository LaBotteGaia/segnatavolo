import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { clearAssist } from "@/lib/assist";
import { DELETE_ACCOUNT_WARNING } from "@/lib/legal";

export function OperatorName({ initial = "", onSaved }: { initial?: string; onSaved?: () => void }) {
  const qc = useQueryClient(); const [name, setName] = useState(initial); const [busy, setBusy] = useState(false);
  return <form className="space-y-4" onSubmit={async (e) => {
    e.preventDefault(); if (!name.trim()) return; setBusy(true);
    const { error } = await supabase.rpc("set_operator_name", { _name: name.trim() });
    setBusy(false); if (error) { toast.error("Impossibile salvare il nome operatore"); return; }
    await qc.invalidateQueries({ queryKey: ["membership"] }); onSaved?.();
  }}><div><Label htmlFor="operator-name">Nome o Nickname di Sala</Label><Input id="operator-name" required maxLength={80} value={name} placeholder="Marco, Elena Cassa, Chef" onChange={(e) => setName(e.target.value)} /></div><Button type="submit" disabled={busy || !name.trim()}>Salva nome operatore</Button></form>;
}
export function OperatorNameDialog({ open, onOpenChange, name, deleteOnly = false }: { open: boolean; onOpenChange: (open: boolean) => void; name: string; deleteOnly?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const deleteAccount = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      setBusy(false);
      setConfirmOpen(false);
      toast.error(error.message.includes("unico Master") ? error.message : "Eliminazione non riuscita, riprova");
      return;
    }
    await qc.cancelQueries();
    qc.clear();
    clearAssist();
    await supabase.auth.signOut();
    onOpenChange(false);
    navigate({ to: "/auth", replace: true });
    toast.success("Account eliminato: accesso revocato");
  };

  return (
    <>
      <Dialog open={!deleteOnly && open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Profilo operatore</DialogTitle></DialogHeader>
          <OperatorName initial={name} onSaved={() => onOpenChange(false)} />
          <div className="border-t pt-4">
            <Button variant="ghost" className="w-full justify-start bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive" onClick={() => setConfirmOpen(true)}>
              Elimina il mio account operatore
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteOnly ? open : confirmOpen} onOpenChange={deleteOnly ? onOpenChange : setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare l'account?</AlertDialogTitle>
            <AlertDialogDescription>{DELETE_ACCOUNT_WARNING}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); deleteAccount(); }} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? "Eliminazione…" : "Elimina definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}