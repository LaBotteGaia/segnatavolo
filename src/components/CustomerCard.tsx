import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { normPhone, rangesOf, shiftName, useTables, type Customer, type Shift } from "@/lib/data";
import { useSettings } from "@/lib/membership";
import { useCustomerHistory, useServiceClock } from "@/lib/extras";
import { customerRows, customerStats, fullName, firstOf, habits, lastOf } from "@/lib/customers";

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
    const { data, error } = customer
      ? await supabase.from("customers").update(row).eq("id", customer.id).select("*").single()
      : await supabase.from("customers").insert(row).select("*").single();
    setBusy(false);
    if (error) { toast.error("Salvataggio non riuscito"); return; }
    qc.invalidateQueries({ queryKey: ["customers"] });
    toast.success(customer ? "Scheda cliente aggiornata" : "Cliente aggiunto alla rubrica");
    if (!customer && data) onOpenChange(false);
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
      </DialogContent>
    </Dialog>
  );
}
