import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CircleHelp, Download, Bell, Building2, LayoutGrid, LogOut, Menu, Plus, Trash2, Users } from "lucide-react";
import { TutorialDialog } from "@/components/TutorialDialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifyPref } from "@/lib/notifications";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { UsersDialog } from "@/components/UsersDialog";
import { useMembership } from "@/lib/membership";
import { APP_NAME, toCsv } from "@/lib/extras";
import { VersionBadge } from "@/components/agenda/Extras";
import { ConnectionDot } from "@/components/ConnectionDot";
import { ALL_SHIFTS, normalizeSettings, shiftName, totalCapacities, useRooms, useTables, type RestaurantSettings, type Shift } from "@/lib/data";

export function AppMenu({ triggerClassName }: { triggerClassName?: string }) {
  const { data: me } = useMembership();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const isMaster = me?.role === "master";
  const [notify, setNotify] = useNotifyPref();

  const exportCsv = async () => {
    const { data, error } = await supabase.from("reservations").select("*").order("date").order("time");
    if (error || !data) { toast.error("Esportazione non riuscita"); return; }
    const byId = new Map((qc.getQueryData<{ id: string; name: string }[]>(["tables"]) ?? []).map((t) => [t.id, t.name]));
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
            <label className="mb-3 flex items-center gap-3 rounded-md border px-3 py-2.5">
              <Bell className="size-4" />
              <span className="flex-1 text-sm">🔔 Notifiche nuove prenotazioni</span>
              <Switch checked={notify} onCheckedChange={setNotify} aria-label="Notifiche nuove prenotazioni" />
            </label>
            <Link to="/rubrica" onClick={() => setOpen(false)} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left font-semibold hover:bg-accent [&_svg]:size-4">
              <Users /> 👥 Rubrica Clienti
            </Link>
            <MenuItem icon={<Download />} onClick={() => { setOpen(false); exportCsv(); }}>📥 Esporta Dati (Backup)</MenuItem>
            <MenuItem icon={<CircleHelp />} onClick={() => { setOpen(false); setTutorialOpen(true); }}>❓ Guida Rapida / Tutorial</MenuItem>
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
      <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
      {me && isMaster && <UsersDialog open={usersOpen} onOpenChange={setUsersOpen} me={me} />}
      {me && isMaster && <RestaurantDialog open={restOpen} onOpenChange={setRestOpen} id={me.restaurant_id} name={me.restaurants?.name ?? ""} settings={me.restaurants?.settings} />}
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

const ALL_TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const WEEKDAYS: [string, string][] = [["1", "Lunedì"], ["2", "Martedì"], ["3", "Mercoledì"], ["4", "Giovedì"], ["5", "Venerdì"], ["6", "Sabato"], ["0", "Domenica"]];

function RestaurantDialog({ open, onOpenChange, id, name, settings }: { open: boolean; onOpenChange: (o: boolean) => void; id: string; name: string; settings: unknown }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(name);
  const [st, setSt] = useState<RestaurantSettings>(() => normalizeSettings(settings));
  const setShift = (s: Shift, patch: Partial<RestaurantSettings["shifts"][Shift]>) =>
    setSt((o) => ({ ...o, shifts: { ...o.shifts, [s]: { ...o.shifts[s], ...patch } } }));
  const toggleWeekly = (day: string, s: Shift) =>
    setSt((o) => {
      const cur = o.weekly[day] ?? [];
      return { ...o, weekly: { ...o.weekly, [day]: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] } };
    });
  const active = ALL_SHIFTS.filter((s) => st.shifts[s].enabled);
  const { data: rooms = [] } = useRooms();
  const { data: tables = [] } = useTables();
  const cap = totalCapacities(rooms, tables);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    for (const s of active) if (st.shifts[s].from >= st.shifts[s].to) { toast.error(`${shiftName(s)}: l'orario di fine deve essere dopo l'inizio`); return; }
    if (st.holidays.some((h) => !h.from || !h.to || h.from > h.to)) { toast.error("Controlla le date delle ferie"); return; }
    const { error } = await supabase.from("restaurants").update({ name: value.trim(), settings: st }).eq("id", id);
    if (error) { toast.error("Salvataggio non riuscito"); return; }
    toast.success("Ristorante aggiornato");
    qc.invalidateQueries({ queryKey: ["membership"] });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) { setValue(name); setSt(normalizeSettings(settings)); } onOpenChange(o); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
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

          <section className="space-y-2">
            <h3 className="font-display text-lg">Turni e orari</h3>
            {ALL_SHIFTS.map((s) => (
              <div key={s} className="rounded-md border p-3">
                <label className="flex items-center justify-between font-semibold">
                  {shiftName(s)}
                  <Switch checked={st.shifts[s].enabled} onCheckedChange={(v) => setShift(s, { enabled: v })} aria-label={`Attiva ${shiftName(s)}`} />
                </label>
                {st.shifts[s].enabled && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["from", "to"] as const).map((k) => (
                      <div key={k}>
                        <div className="text-xs text-muted-foreground">{k === "from" ? "Inizio servizio" : "Fine servizio"}</div>
                        <Select value={st.shifts[s][k]} onValueChange={(v) => setShift(s, { [k]: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{ALL_TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h3 className="font-display text-lg">Rotazione tavoli</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Durata standard tavolo
                <select className="mt-1 w-full rounded-md border bg-paper px-2 py-2" value={st.duration} onChange={(e) => setSt((o) => ({ ...o, duration: Number(e.target.value) }))}>
                  {Array.from({ length: 16 }, (_, i) => (i + 2) * 15).map((m) => <option key={m} value={m}>{Math.floor(m / 60)}h {String(m % 60).padStart(2, "0")}m</option>)}
                </select>
              </label>
              <label className="text-sm">Margine di riallestimento (Buffer pulizia)
                <select className="mt-1 w-full rounded-md border bg-paper px-2 py-2" value={st.buffer} onChange={(e) => setSt((o) => ({ ...o, buffer: Number(e.target.value) }))}>
                  {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-display text-lg">Privacy</h3>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={st.privacy} onChange={(e) => setSt((o) => ({ ...o, privacy: e.target.checked }))} /> Modalità Privacy al banco (Maschera numeri telefonici)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={st.printPhones} onChange={(e) => setSt((o) => ({ ...o, printPhones: e.target.checked }))} /> Mostra numeri completi sul Foglio di Sala stampato</label>
          </section>

          <section className="space-y-2">
            <h3 className="font-display text-lg">Chiusure settimanali</h3>
            <p className="text-xs text-muted-foreground">Tocca i turni in cui il ristorante è chiuso.</p>
            {WEEKDAYS.map(([d, label]) => {
              const cur = st.weekly[d] ?? [];
              const all = active.length > 0 && active.every((s) => cur.includes(s));
              return (
                <div key={d} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-24 text-sm font-semibold">{label}</span>
                  <button type="button" onClick={() => setSt((o) => ({ ...o, weekly: { ...o.weekly, [d]: all ? [] : [...active] } }))}
                    className={`rounded-full border px-2.5 py-1 text-xs ${all ? "border-destructive bg-destructive text-destructive-foreground" : ""}`}>Tutto il giorno</button>
                  {active.map((s) => (
                    <button key={s} type="button" onClick={() => toggleWeekly(d, s)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${cur.includes(s) ? "border-destructive bg-destructive/15 text-destructive" : ""}`}>{shiftName(s)}</button>
                  ))}
                </div>
              );
            })}
          </section>

          <section className="space-y-2">
            <h3 className="font-display text-lg">Ferie e chiusure straordinarie</h3>
            {st.holidays.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs">dal</span>
                <Input type="date" value={h.from} onChange={(e) => setSt((o) => ({ ...o, holidays: o.holidays.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) }))} />
                <span className="text-xs">al</span>
                <Input type="date" value={h.to} onChange={(e) => setSt((o) => ({ ...o, holidays: o.holidays.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) }))} />
                <Button type="button" size="icon" variant="ghost" aria-label="Rimuovi" onClick={() => setSt((o) => ({ ...o, holidays: o.holidays.filter((_, j) => j !== i) }))}><Trash2 /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setSt((o) => ({ ...o, holidays: [...o.holidays, { from: "", to: "" }] }))}><Plus /> Aggiungi periodo</Button>
          </section>

          <Button type="submit" className="w-full">Salva</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
