import { RecycleBinDialog } from "@/components/RecycleBinDialog";
import { OperatorProfileDialog } from "@/components/OperatorProfileDialog";
import { OperatorNameDialog } from "@/components/OperatorName";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, CircleHelp, Download, Bell, Lock, LogOut, Menu, Moon, Printer, Radio, Scale, Settings, ShieldCheck, Sun, Trash2, UserCog, UserRound, Users } from "lucide-react";
import { TutorialDialog } from "@/components/TutorialDialog";
import { Switch } from "@/components/ui/switch";
import { useNotifyPref } from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { UsersDialog } from "@/components/UsersDialog";
import { useMembership } from "@/lib/membership";
import { APP_NAME, APP_VERSION, toCsv } from "@/lib/extras";
import { COPYRIGHT_LINE, LEGAL_LINK_LABEL, LEGAL_URL, SERVER_REGION_LINE } from "@/lib/legal";
import { VersionBadge } from "@/components/agenda/Extras";
import { ConnectionDot } from "@/components/ConnectionDot";
import { shiftName, type Shift } from "@/lib/data";
import { clearAssist, useIsSuperAdmin } from "@/lib/assist";
import { scopeRestaurant } from "@/lib/tenant";

export function AppMenu({ triggerClassName }: { triggerClassName?: string }) {
  const { data: me } = useMembership();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [binOpen, setBinOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isMaster = me?.role === "master";
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const [notify, setNotify] = useNotifyPref();
  const [theme, setTheme] = useTheme();
  const canManage = isMaster || !!isSuperAdmin;

  const exportCsv = async () => {
    const { data, error } = await scopeRestaurant(supabase.from("reservations").select("*"), me?.restaurant_id).is("deleted_at", null).eq("status", "confirmed").order("date").order("time");
    if (error || !data) { toast.error("Esportazione non riuscita"); return; }
    const byId = new Map((qc.getQueryData<{ id: string; name: string }[]>(["tables", me?.restaurant_id]) ?? []).map((t) => [t.id, t.name]));
    const rows = data.map((r) => ({ ...r, tavoli: r.table_ids.map((i) => byId.get(i) ?? "?"), turno: shiftName(r.shift as Shift), arrivato: r.arrived ? "Sì" : "No", fuori: r.outside ? "Sì" : "No", nuovo: r.is_new ? "Sì" : "No" }));
    const csv = toCsv(rows, [
      { key: "date", label: "Data" }, { key: "turno", label: "Turno" }, { key: "time", label: "Orario" }, { key: "name", label: "Nome" },
      { key: "phone", label: "Telefono" }, { key: "people", label: "Coperti" }, { key: "tavoli", label: "Tavolo" }, { key: "notes", label: "Richieste particolari" },
      { key: "fuori", label: "Fuori" }, { key: "nuovo", label: "Nuovo cliente" }, { key: "arrivato", label: "Arrivato" },
    ]);
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `segnatavolo-backup-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Esportate ${data.length} prenotazioni`);
  };

  const logout = async () => {
    await qc.cancelQueries();
    qc.clear();
    clearAssist();
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
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{APP_NAME} <VersionBadge /> <ConnectionDot /></div>
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
            <MenuHeading>Sala &amp; Servizio</MenuHeading>
            <MenuLink to="/agenda" icon={<CalendarDays />} close={() => setOpen(false)}>Agenda Prenotazioni</MenuLink>
            <MenuItem icon={<Radio />} onClick={() => { setOpen(false); navigate({ to: "/agenda", search: { live: true } }); }}>Modalità Sala Live</MenuItem>
            <Button asChild variant="ghost" className="h-auto min-h-10 w-full justify-start gap-3 whitespace-normal px-3 py-2.5 text-left [&_svg]:size-4 [&_svg]:shrink-0"><Link to="/foglio" search={{ d: new Date().toLocaleDateString("sv-SE"), s: new Date().getHours() < 16 ? "pranzo" : "sera" }} onClick={() => setOpen(false)}><Printer /><span>Stampa Foglio di Sala</span></Link></Button>
            <MenuLink to="/rubrica" icon={<Users />} close={() => setOpen(false)}>Rubrica Clienti</MenuLink>
            <MenuItem icon={<ClipboardList />} onClick={() => { setOpen(false); navigate({ to: "/agenda", search: { service: true } }); }}>Strumenti di servizio</MenuItem>
            <MenuItem icon={<Trash2 />} onClick={() => { setOpen(false); setBinOpen(true); }}>Cestino del giorno</MenuItem>

            <MenuHeading>Gestione</MenuHeading>
            {canManage ? <>
              <MenuLink to="/settings" icon={<Settings />} close={() => setOpen(false)}>Configurazione Ristorante</MenuLink>
              <MenuItem icon={<UserCog />} onClick={() => { setOpen(false); setUsersOpen(true); }}>Personale &amp; Ruoli</MenuItem>
            </> : <>
              <LockedItem icon={<Settings />}>Configurazione Ristorante</LockedItem>
              <LockedItem icon={<UserCog />}>Personale &amp; Ruoli</LockedItem>
              <p className="px-3 pb-1 text-xs text-muted-foreground">Sezione riservata al Master.</p>
            </>}
            {isSuperAdmin && <MenuLink to="/admin" icon={<ShieldCheck />} close={() => setOpen(false)}>Pannello Super Admin / Assistenza</MenuLink>}

            <MenuHeading>Sistema</MenuHeading>
            <label className="flex items-center gap-3 px-3 py-2.5">
              {theme === "dark" ? <Moon className="size-4 shrink-0" /> : <Sun className="size-4 shrink-0" />}<span className="flex-1 text-sm">Tema scuro</span>
              <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} aria-label="Tema scuro" />
            </label>
            <MenuItem icon={<UserRound />} onClick={() => { setOpen(false); setOperatorOpen(true); }}>Il Mio Profilo</MenuItem>
            <label className="flex items-center gap-3 px-3 py-2.5">
              <Bell className="size-4 shrink-0" /><span className="flex-1 text-sm">Notifiche nuove prenotazioni</span>
              <Switch checked={notify} onCheckedChange={setNotify} aria-label="Notifiche nuove prenotazioni" />
            </label>
            <MenuItem icon={<Download />} onClick={() => { setOpen(false); exportCsv(); }}>Esporta Dati (Backup CSV)</MenuItem>
            <MenuItem icon={<CircleHelp />} onClick={() => { setOpen(false); setTutorialOpen(true); }}>Guida Rapida / Tutorial</MenuItem>
            <MenuItem icon={<Scale />} onClick={() => { setOpen(false); setLegalOpen(true); }}>Informazioni app e legali</MenuItem>
            <Button asChild variant="ghost" className="h-auto w-full justify-start gap-3 px-3 py-2.5 text-left"><a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><Scale className="size-4 shrink-0" /> Termini &amp; Privacy</a></Button>
            <MenuItem icon={<Trash2 />} onClick={() => { setOpen(false); setDeleteOpen(true); }}>Elimina il mio account</MenuItem>
          </nav>

          <div className="border-t p-3">
            <div className="mb-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">{APP_NAME} <VersionBadge /> <ConnectionDot /></div>
            <Button variant="ghost" className="w-full justify-start bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive" onClick={logout}>
              <LogOut /> Esci / Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <OperatorProfileDialog open={operatorOpen} onOpenChange={setOperatorOpen} />
      <OperatorNameDialog open={deleteOpen} onOpenChange={setDeleteOpen} name="" deleteOnly />
      <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
      <RecycleBinDialog open={binOpen} onOpenChange={setBinOpen} />
      <LegalDialog open={legalOpen} onOpenChange={setLegalOpen} />
      {me && (isMaster || isSuperAdmin) && <UsersDialog open={usersOpen} onOpenChange={setUsersOpen} me={me} />}
    </>
  );
}

function LegalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Informazioni legali e Privacy</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="block rounded-md border p-3 font-semibold text-primary underline">
            {LEGAL_LINK_LABEL}
          </a>
          <dl className="space-y-2">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Versione app</dt><dd className="font-semibold">{APP_NAME} {APP_VERSION}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Copyright</dt><dd className="font-semibold">{COPYRIGHT_LINE}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Server dati</dt><dd className="text-right font-semibold">{SERVER_REGION_LINE}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">Per eliminare il tuo account operatore scegli "Elimina il mio account" dal menù.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MenuHeading({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 mt-3 border-t px-3 pb-1 pt-3 text-[10px] font-bold uppercase text-muted-foreground first:mt-0 first:border-0 first:pt-0">{children}</div>;
}
function MenuLink({ to, icon, close, children }: { to: "/agenda" | "/rubrica" | "/sale" | "/admin" | "/regole" | "/settings"; icon: React.ReactNode; close: () => void; children: React.ReactNode }) {
  return <Button asChild variant="ghost" className="h-auto min-h-10 w-full justify-start gap-3 whitespace-normal px-3 py-2.5 text-left [&_svg]:size-4 [&_svg]:shrink-0"><Link to={to} onClick={close}>{icon}<span className="min-w-0">{children}</span></Link></Button>;
}

function LockedItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <Button variant="ghost" disabled aria-disabled className="h-auto min-h-10 w-full justify-start gap-3 whitespace-normal px-3 py-2.5 text-left [&_svg]:size-4 [&_svg]:shrink-0">{icon}<span className="flex-1">{children}</span><Lock /></Button>;
}

function MenuItem({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} className="h-auto min-h-10 w-full justify-start gap-3 whitespace-normal px-3 py-2.5 text-left [&_svg]:size-4 [&_svg]:shrink-0">
      {icon} {children}
    </Button>
  );
}

