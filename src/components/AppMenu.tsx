import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, LayoutGrid, LogOut, Menu, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { UsersDialog } from "@/components/UsersDialog";
import { useMembership } from "@/lib/membership";
import { totalCapacities, useRooms, useTables } from "@/lib/data";

export function AppMenu({ triggerClassName }: { triggerClassName?: string }) {
  const { data: me } = useMembership();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const isMaster = me?.role === "master";

  const logout = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="icon" variant="ghost" className={triggerClassName} aria-label="Apri menù">
            <Menu className="size-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="flex w-80 flex-col gap-0 p-0">
          <SheetHeader className="border-b p-5 text-left">
            <SheetTitle className="sr-only">Menù</SheetTitle>
            {me && (
              <div className="min-w-0">
                <div className="truncate font-display text-xl text-primary">{me.name || me.email}</div>
                {me.name && <div className="truncate text-xs text-muted-foreground">{me.email}</div>}
                <span className="mt-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {isMaster ? "👑 Master" : "👤 Staff"}
                </span>
                <div className="mt-2 truncate text-sm font-semibold">{me.restaurants?.name}</div>
              </div>
            )}
          </SheetHeader>

          <nav className="flex-1 overflow-y-auto p-3">
            {isMaster && (
              <>
                <div className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Configurazione</div>
                <MenuItem icon={<Building2 />} onClick={() => { setOpen(false); setRestOpen(true); }}>Gestione Ristorante</MenuItem>
                <Link to="/sale" onClick={() => setOpen(false)} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-accent [&_svg]:size-4">
                  <LayoutGrid /> Gestione Sale e Mappe
                </Link>
                <MenuItem icon={<Users />} onClick={() => { setOpen(false); setUsersOpen(true); }}>Gestione Utenti e Inviti</MenuItem>
              </>
            )}
          </nav>

          <div className="border-t p-3">
            <Button variant="ghost" className="w-full justify-start bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive" onClick={logout}>
              <LogOut /> Esci (Logout)
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {me && isMaster && <UsersDialog open={usersOpen} onOpenChange={setUsersOpen} me={me} />}
      {me && isMaster && <RestaurantDialog open={restOpen} onOpenChange={setRestOpen} id={me.restaurant_id} name={me.restaurants?.name ?? ""} />}
    </>
  );
}

function MenuItem({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-accent [&_svg]:size-4">
      {icon} {children}
    </button>
  );
}

function RestaurantDialog({ open, onOpenChange, id, name }: { open: boolean; onOpenChange: (o: boolean) => void; id: string; name: string }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(name);
  const { data: rooms = [] } = useRooms();
  const { data: tables = [] } = useTables();
  const cap = totalCapacities(rooms, tables);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    const { error } = await supabase.from("restaurants").update({ name: value.trim() }).eq("id", id);
    if (error) { toast.error("Salvataggio non riuscito"); return; }
    toast.success("Ristorante aggiornato");
    qc.invalidateQueries({ queryKey: ["membership"] });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setValue(name); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gestione Ristorante</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="rname">Nome del ristorante</Label>
            <Input id="rname" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-md border p-3"><div className="font-display text-2xl">{cap.inside}</div><div className="text-xs text-muted-foreground">Capienza interna</div></div>
            <div className="rounded-md border p-3"><div className="font-display text-2xl">{cap.outside}</div><div className="text-xs text-muted-foreground">Capienza esterna</div></div>
          </div>
          <p className="text-xs text-muted-foreground">La capienza si imposta per ogni sala in "Gestione Sale e Mappe".</p>
          <Button type="submit" className="w-full">Salva</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
