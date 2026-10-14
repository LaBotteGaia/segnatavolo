import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { findCustomer, useCustomers, type Customer } from "@/lib/data";

export type NewReservationInput = {
  time: string;
  name: string;
  people: number;
  phone: string;
  is_new: boolean;
  outside: boolean;
  notes: string;
  customer?: Customer;
};

export function NewReservationRow({ defaultTime, onCreate }: { defaultTime: string; onCreate: (v: NewReservationInput) => Promise<void> }) {
  const { data: customers } = useCustomers();
  const [time, setTime] = useState(defaultTime);
  const [name, setName] = useState("");
  const [people, setPeople] = useState(2);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [outside, setOutside] = useState(false);
  const [focus, setFocus] = useState(false);
  const [busy, setBusy] = useState(false);

  const match = findCustomer(customers, name);
  const isNew = name.trim().length > 0 && !match;
  const suggestions =
    name.trim().length >= 1 && !match
      ? (customers ?? []).filter((c) => c.name.toLowerCase().includes(name.trim().toLowerCase())).slice(0, 6)
      : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await onCreate({ time, name: name.trim(), people, phone: match ? match.phone ?? "" : phone, is_new: isNew, outside, notes, customer: match });
    setBusy(false);
    setName("");
    setPhone("");
    setNotes("");
    setPeople(2);
    setOutside(false);
  };

  return (
    <form onSubmit={submit} className="mt-3 rounded-md border border-dashed border-primary/40 bg-card/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="20:30" className="w-16 rounded border bg-paper px-2 py-1.5 font-display tabular-nums" />
        <div className="relative min-w-[8rem] flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Nome cliente"
            className="w-full rounded border bg-paper px-2 py-1.5 font-hand text-lg"
          />
          {focus && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border bg-popover shadow-lg">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button type="button" onMouseDown={() => setName(c.name)} className="w-full px-3 py-2 text-left font-hand text-lg hover:bg-accent">
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input type="number" min={1} value={people} onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))} className="w-14 rounded border bg-paper px-2 py-1.5 text-center font-display" aria-label="Persone" />
        {isNew && (
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Telefono" className="w-32 rounded border bg-paper px-2 py-1.5" />
        )}
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Richieste particolari" className="min-w-[8rem] flex-1 rounded border bg-paper px-2 py-1.5 font-hand" />
        <label className="flex items-center gap-1 text-xs"><Checkbox checked={outside} onCheckedChange={(v) => setOutside(!!v)} /> Fuori</label>
        <label className="flex items-center gap-1 text-xs"><Checkbox checked={isNew} disabled /> Nuovo</label>
        <Button type="submit" size="sm" disabled={busy || !name.trim()}><Plus /> Aggiungi</Button>
      </div>
      {match && <p className="mt-1 text-xs text-muted-foreground">Cliente già in archivio{match.notes ? ` · ${match.notes}` : ""}</p>}
    </form>
  );
}
