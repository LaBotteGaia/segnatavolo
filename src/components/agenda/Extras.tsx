import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { APP_VERSION, lastVisitText, saveServiceNote, searchFilter, useServiceNote, useVisitStats } from "@/lib/extras";
import { shiftName, tableLabel, useRooms, useTables, type Reservation, type Shift } from "@/lib/data";
import { useMembership } from "@/lib/membership";
import { ChangelogDialog } from "@/components/ChangelogDialog";

export function VersionBadge({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Novità e storico versioni"
        className={cn("inline-block rounded border border-current/30 px-1.5 py-px font-mono text-[10px] opacity-70 hover:opacity-100", className)}>{APP_VERSION}</button>
      <ChangelogDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function LoyaltyBox({ customerId, phone, excludeId, isNew }: { customerId?: string | null; phone?: string | null; excludeId?: string; isNew?: boolean }) {
  const { data } = useVisitStats(isNew ? null : customerId, isNew ? null : phone, excludeId);
  if (isNew || !data || data.count === 0)
    return <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">🌱 Nuovo cliente (Prima visita)</div>;
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
      <div className="font-semibold text-primary">⭐ Visite registrate: {data.count} {data.count === 1 ? "volta" : "volte"}</div>
      {data.last && <div className="text-muted-foreground">Ultima visita: {lastVisitText(data.last)}</div>}
    </div>
  );
}

export function SearchBox({ onPick, className }: { onPick: (r: Reservation) => void; className?: string }) {
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { data: rooms } = useRooms();
  const { data: tables } = useTables();
  useEffect(() => { const t = setTimeout(() => setDeb(q), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const filter = searchFilter(deb);
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["search", deb], enabled: !!filter,
    queryFn: async () => {
      const { data } = await supabase.from("reservations").select("*").or(filter!).order("date", { ascending: false }).limit(20);
      return data ?? [];
    },
  });
  return (
    <div ref={box} className={cn("relative min-w-0 flex-1", className)}>
      <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 opacity-60" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Cerca per nome o telefono..." aria-label="Cerca prenotazioni"
        className="h-9 w-full rounded-md border border-primary-foreground/20 bg-primary-foreground/10 pl-8 pr-7 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/60" />
      {q && <button type="button" aria-label="Cancella ricerca" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70"><X className="size-4" /></button>}
      {open && filter && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg sm:w-96">
          {results.map((r) => (
            <button key={r.id} type="button" onClick={() => { setOpen(false); setQ(""); onPick(r); }}
              className="block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-accent">
              <div className="flex justify-between gap-2"><span className="font-semibold">{r.name || "—"}</span><span className="font-bold text-primary">{r.people}p</span></div>
              <div className="text-xs text-muted-foreground">
                {format(parseISO(r.date), "EEE d MMM yyyy", { locale: it })} · {shiftName(r.shift as Shift)} {r.time}
                {r.table_ids.length ? ` · ${tableLabel(r.table_ids, tables, rooms)}` : " · Tavolo da assegnare"}
              </div>
            </button>
          ))}
          {!results.length && <div className="px-3 py-2 text-sm text-muted-foreground">{isFetching ? "Ricerca…" : "Nessun risultato"}</div>}
        </div>
      )}
    </div>
  );
}

export function ServiceNotes({ date, shift }: { date: string; shift: Shift }) {
  const { data: me } = useMembership();
  const { data = "" } = useServiceNote(date, shift);
  const [text, setText] = useState(data);
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setText(data); }, [data, focus]);
  const save = async () => {
    setFocus(false);
    if (!me || text === data) return;
    const { error } = await saveServiceNote(me.restaurant_id, date, shift, text);
    if (error) toast.error("Nota non salvata");
  };
  return (
    <div className="mb-3 rounded-md border border-warning/50 bg-warning/10 p-2">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">📝 Note di Servizio {shiftName(shift)}</div>
      <textarea value={text} rows={text ? 2 : 1} onFocus={() => setFocus(true)} onChange={(e) => setText(e.target.value)} onBlur={save}
        placeholder="Es. finita la tagliata, compleanno tavolo 3…"
        className="w-full resize-y bg-transparent font-hand text-base text-ink outline-none" />
    </div>
  );
}
