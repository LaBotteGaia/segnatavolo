import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function OperatorName({ initial = "", onSaved }: { initial?: string; onSaved?: () => void }) {
  const qc = useQueryClient(); const [name, setName] = useState(initial); const [busy, setBusy] = useState(false);
  return <form className="space-y-4" onSubmit={async (e) => {
    e.preventDefault(); if (!name.trim()) return; setBusy(true);
    const { error } = await supabase.rpc("set_operator_name", { _name: name.trim() });
    setBusy(false); if (error) { toast.error("Impossibile salvare il nome operatore"); return; }
    await qc.invalidateQueries({ queryKey: ["membership"] }); onSaved?.();
  }}><div><Label htmlFor="operator-name">Nome o Nickname di Sala</Label><Input id="operator-name" required maxLength={80} value={name} placeholder="Marco, Elena Cassa, Chef" onChange={(e) => setName(e.target.value)} /></div><Button type="submit" disabled={busy || !name.trim()}>Salva nome operatore</Button></form>;
}
export function OperatorNameDialog({ open, onOpenChange, name }: { open: boolean; onOpenChange: (open: boolean) => void; name: string }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Nome operatore</DialogTitle></DialogHeader><OperatorName initial={name} onSaved={() => onOpenChange(false)} /></DialogContent></Dialog>;
}