import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RestaurantGate } from "@/components/RestaurantGate";
import { CustomerCard } from "@/components/CustomerCard";
import { AppMenu } from "@/components/AppMenu";
import { MaskedPhone } from "@/components/MaskedPhone";
import { rangesOf, useCustomers, type Customer } from "@/lib/data";
import { useSettings } from "@/lib/membership";
import { useCustomerHistory, useServiceClock } from "@/lib/extras";
import { customerStats, displayName, initialOf, matchesSearch, SORT_LABELS, sortCustomers, sortKey, type CustomerStats, type SortMode } from "@/lib/customers";

export const Route = createFileRoute("/_authenticated/rubrica")({
  head: () => ({
    meta: [
      { title: "Rubrica Clienti — Segnatavolo" },
      { name: "description", content: "Rubrica dei clienti del ristorante con visite, No-Show e abitudini." },
      { property: "og:title", content: "Rubrica Clienti — Segnatavolo" },
      { property: "og:description", content: "Rubrica dei clienti del ristorante con visite, No-Show e abitudini." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RestaurantGate><Rubrica /></RestaurantGate>,
});

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

function Rubrica() {
  const navigate = useNavigate();
  const { data: customers = [] } = useCustomers();
  const { data: history = [] } = useCustomerHistory();
  const settings = useSettings(); const now = useServiceClock();
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<SortMode>("last");
  const [card, setCard] = useState<{ c: Customer | null } | null>(null);
  const refs = useRef(new Map<string, HTMLElement>());

  const stats = useMemo(() => {
    const ranges = rangesOf(settings);
    return new Map<string, CustomerStats>(customers.map((c) => [c.id, customerStats(c, history, ranges, now)]));
  }, [customers, history, settings, now]);
  const list = useMemo(() => sortCustomers(customers.filter((c) => matchesSearch(c, term)), sort, stats), [customers, term, sort, stats]);
  const alpha = sort === "last" || sort === "first";
  const firstByLetter = new Map<string, string>();
  if (alpha) for (const c of list) { const l = initialOf(sortKey(c, sort)); if (!firstByLetter.has(l)) firstByLetter.set(l, c.id); }

  const book = (c: Customer) => navigate({ to: "/agenda", search: { c: c.id } });
  const current = card?.c ? customers.find((x) => x.id === card.c!.id) ?? card.c : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-paper/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button asChild size="icon" variant="ghost" aria-label="Torna all'agenda"><Link to="/agenda"><ArrowLeft /></Link></Button>
          <h1 className="flex-1 font-display text-2xl text-primary">👥 Rubrica Clienti</h1>
          <AppMenu />
        </div>
        <div className="mx-auto mt-2 flex max-w-3xl flex-wrap gap-2">
          <label className="flex min-w-48 flex-1 items-center gap-2 rounded-md border bg-paper px-3">
            <Search className="size-4 text-muted-foreground" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Cerca nome, cognome, telefono o email…" className="w-full bg-transparent py-2 outline-none" />
          </label>
          <Button onClick={() => setCard({ c: null })}><Plus /> Nuovo Cliente</Button>
          <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
            <SelectTrigger className="w-full bg-paper sm:w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(SORT_LABELS) as SortMode[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl gap-2 p-3">
        <ul className="min-w-0 flex-1 divide-y rounded-md border bg-paper">
          {list.length === 0 && <li className="p-6 text-center text-muted-foreground">Nessun cliente trovato.</li>}
          {list.map((c) => {
            const s = stats.get(c.id);
            return (
              <li key={c.id} ref={(el) => { if (el) refs.current.set(c.id, el); }} className="flex scroll-mt-40 items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setCard({ c })} className="min-w-0 flex-1 text-left">
                  <div className="truncate font-semibold">{displayName(c)}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    <MaskedPhone phone={c.phone} />
                    <span className="rounded-full bg-muted px-2 text-xs">{s?.visits ?? 0} {s?.visits === 1 ? "visita" : "visite"}</span>
                    {!!s?.noShows && <span className="rounded-full bg-destructive/15 px-2 text-xs font-semibold text-destructive">⚠️ {s.noShows} No-Show</span>}
                  </div>
                </button>
                <Button size="sm" variant="outline" onClick={() => book(c)}>📅 Prenota</Button>
              </li>
            );
          })}
        </ul>
        {alpha && list.length > 0 && (
          <nav aria-label="Indice alfabetico" className="sticky top-40 flex h-fit flex-col text-[11px] font-bold leading-tight">
            {LETTERS.map((l) => {
              const id = firstByLetter.get(l);
              return (
                <button key={l} type="button" disabled={!id} onClick={() => id && refs.current.get(id)?.scrollIntoView({ block: "start" })}
                  className={id ? "px-1 text-primary" : "px-1 text-muted-foreground/40"}>{l}</button>
              );
            })}
          </nav>
        )}
      </div>

      <CustomerCard open={!!card} onOpenChange={(o) => !o && setCard(null)} customer={current} onBook={book} />
    </div>
  );
}
