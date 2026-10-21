import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { normPhone, rangesOf, shiftName, useTables, type Customer, type Shift } from "@/lib/data";
import { useMembership, useSettings } from "@/lib/membership";
import { scopeAssist } from "@/lib/assist";
import { useCustomerHistory, useServiceClock } from "@/lib/extras";
import { customerRows, customerStats, fullName, firstOf, habits, lastOf, phonesOf } from "@/lib/customers";

/** Prenotazioni collegate al cliente (per id o per uno dei suoi telefoni). */
async function linkedReservations(c: Customer) {
  const ph = phonesOf(c);
  const filter = [`customer_id.eq.${c.id}`, ...(ph.length ? [`phone.in.(${ph.map((p) => `"${p}"`).join(",")})`] : [])].join(",");
  const { data, error } = await scopeAssist(supabase.from("reservations").select("id, phone")).or(filter);
  if (error) throw error;
  return data ?? [];
}

const field = "w-full rounded-md border bg-paper px-3 py-2";
const lbl = "text-xs font-semibold text-muted-foreground";

/** Scheda cliente: nuova (customer = null) o modifica. */
export function CustomerCard({ open, onOpenChange, customer, onBook }: {
  open: boolean; onOpenChange: (o: boolean) => void; customer: Customer | null; onBook?: (c: Customer) => void;
}) {
  const qc = useQueryClient();
  const [first, setFirst] = useState(""); const [last, setLast] = useState("");
  const [phones, setPhones] = useState<string[]>([""]); const [emails, setEmails] = useState<string[]>([""]);
  const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false);
  const { data: history = [] } = useCustomerHistory();
  const { data: tables = [] } = useTables();
  const settings = useSettings(); const now = useServiceClock();
  const { data: me } = useMembership(); const isMaster = me?.role === "master";
  const [del, setDel] = useState<{ count: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setFirst(customer ? firstOf(customer) : ""); setLast(customer ? lastOf(customer) : "");
    setPhones(customer ? [customer.phone ?? "", ...(customer.extra_phones ?? [])] : [""]);
    setEmails(customer?.emails?.length ? customer.emails : [""]);
    setNotes(customer?.notes ?? "");
  }, [open, customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = customer ? customerStats(customer, history, rangesOf(settings), now) : null;
  const h = customer ? habits(customerRows(customer, history), (id) => tables.find((t) => t.id === id)?.name) : null;

  const save = async () => {
    if (!first.trim() && !last.trim()) { toast.error("Inserisci almeno il nome o il cognome"); return; }
    const ph = phones.map(normPhone).filter(Boolean);
    const row = {
      first_name: first.trim(), last_name: last.trim(), name: fullName(first, last), phone: ph[0] ?? null, extra_phones: ph.slice(1),
      emails: emails.map((e) => e.trim()).filter(Boolean), notes: notes.trim() || null,
    };
    setBusy(true);
    let linked: { id: string; phone: string | null }[] = [];
    if (customer) { try { linked = await linkedReservations(customer); } catch { /* ignora */ } }
    const { data, error } = customer
      ? await supabase.from("customers").update(row).eq("id", customer.id).select("*").single()
      : await supabase.from("customers").insert(row).select("*").single();
    if (error) { setBusy(false); toast.error("Salvataggio non riuscito"); return; }
    if (customer && linked.length) {
      const keep = linked.filter((r) => ph.includes(normPhone(r.phone))).map((r) => r.id);
      const fix = linked.filter((r) => !ph.includes(normPhone(r.phone))).map((r) => r.id);
      const base = { name: row.name, customer_id: customer.id };
      const res = await Promise.all([
        keep.length ? supabase.from("reservations").update(base).in("id", keep) : null,
        fix.length ? supabase.from("reservations").update({ ...base, phone: row.phone }).in("id", fix) : null,
      ]);
      if (res.some((r) => r?.error)) toast.error("Alcune prenotazioni non sono state aggiornate");
    }
    setBusy(false);
    qc.invalidateQueries();
    toast.success(customer ? "Scheda cliente aggiornata" : "Cliente aggiunto alla rubrica");
    if (!customer && data) onOpenChange(false);
  };

  const askDelete = async () => {
    if (!customer) return;
    try { setDel({ count: (await linkedReservations(customer)).length }); } catch { toast.error("Impossibile contare le prenotazioni"); }
  };
  const doDelete = async () => {
    if (!customer) return;
    setBusy(true);
    try {
      const ids = (await linkedReservations(customer)).map((r) => r.id);
      if (ids.length) { const { error } = await supabase.from("reservations").delete().in("id", ids); if (error) throw error; }
      const { error } = await supabase.from("customers").delete().eq("id", customer.id); if (error) throw error;
      toast.success("Cliente e tutte le prenotazioni collegate eliminati con successo");
      setDel(null); onOpenChange(false); qc.invalidateQueries();
    } catch { toast.error("Eliminazione non riuscita"); }
    setBusy(false);
  };

  const list = (vals: string[], set: (v: string[]) => void, ph: string, type: string, add: string, first: string) => (
    <div className="space-y-2">
      {vals.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input value={v} type={type} placeholder={i === 0 ? first : ph} onChange={(e) => set(vals.map((x, j) => (j === i ? e.target.value : x)))} className={field} />
          {i > 0 && <Button size="icon" variant="ghost" aria-label="Rimuovi" onClick={() => set(vals.filter((_, j) => j !== i))}><X /></Button>}
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => set([...vals, ""])}><Plus /> {add}</Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto bg-paper">
        <DialogHeader><DialogTitle className="font-display text-2xl">{customer ? "Scheda Cliente" : "➕ Nuovo Cliente"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Nome</label><input value={first} onChange={(e) => setFirst(e.target.value)} className={field} /></div>
          <div><label className={lbl}>Cognome</label><input value={last} onChange={(e) => setLast(e.target.value)} className={field} /></div>
        </div>
        <div><label className={lbl}>Telefoni</label>{list(phones, setPhones, "Altro telefono (coniuge, lavoro…)", "tel", "Aggiungi altro telefono", "Telefono principale")}</div>
        <div><label className={lbl}>Email</label>{list(emails, setEmails, "Altra email", "email", "Aggiungi altra email", "Email principale")}</div>
        <div>
          <label className={lbl}>Note fisse / Allergie permanenti</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Celiaco, vegetariano, tavolo vicino alla finestra…" className={field} />
          <p className="mt-1 text-xs text-muted-foreground">Vengono copiate in automatico nelle note di ogni nuova prenotazione.</p>
        </div>

        {customer && stats && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="mb-2 font-semibold">Abitudini del cliente</div>
            {h ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <span>📅 Giorno preferito: <b>{h.day}</b></span>
                <span>🕒 Turno preferito: <b>{h.shift ? shiftName(h.shift as Shift) : "—"}</b></span>
                <span>🗓️ Mese più frequente: <b>{h.month}</b></span>
                <span>🪑 Tavolo più assegnato: <b>{h.table ?? "—"}</b></span>
                <span>👥 Media: <b>{h.avgPeople ?? "—"} persone</b></span>
              </div>
            ) : <p className="text-muted-foreground">Nessuna visita registrata finora.</p>}
            <p className="mt-2">📊 Visite effettuate: <b>{stats.visits}</b> | <span className={stats.noShows ? "font-semibold text-destructive" : ""}>No-Show: {stats.noShows}</span>
              {stats.last && <> · Ultima visita: {format(parseISO(stats.last), "d MMM yyyy", { locale: it })}</>}</p>
          </div>
        )}

        <div className="flex gap-2">
          {customer && onBook && <Button variant="outline" className="flex-1" onClick={() => onBook(customer)}>📅 Prenota</Button>}
          <Button className="flex-1" onClick={save} disabled={busy}>Salva</Button>
        </div>
        {customer && isMaster && (
          <Button variant="destructive" onClick={askDelete} disabled={busy}><Trash2 /> Elimina Cliente</Button>
        )}
        <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
          <AlertDialogContent className="bg-paper">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">⚠️ ATTENZIONE: ELIMINAZIONE DEFINITIVA</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>Stai per eliminare definitivamente il cliente <b>{customer ? fullName(firstOf(customer), lastOf(customer)) || customer.name : ""}</b> dalla rubrica.</p>
                  <p>Questa operazione cancellerà irrevocabilmente TUTTE le sue prenotazioni in agenda:</p>
                  <ul className="list-disc pl-5"><li>Tutte le prenotazioni passate (storico visite)</li><li>Tutte le prenotazioni presenti e future già fissate</li></ul>
                  <p className="font-semibold">Verranno eliminate {del?.count ?? 0} {del?.count === 1 ? "prenotazione collegata" : "prenotazioni collegate"}.</p>
                  <p>Questa azione non può essere annullata. Vuoi davvero procedere?</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel autoFocus>Annulla</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy}
                onClick={(e) => { e.preventDefault(); void doDelete(); }}>Sì, elimina cliente e tutte le prenotazioni</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
