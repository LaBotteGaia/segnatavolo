import { normPhone, type Customer, type Ranges } from "./data";
import { isNoShow, serviceEnded, type HistoryRow } from "./no-show";

export type SortMode = "last" | "first" | "visits" | "recent";
export const SORT_LABELS: Record<SortMode, string> = {
  last: "Ordina per Cognome (A–Z)",
  first: "Ordina per Nome (A–Z)",
  visits: "Numero di Visite (Abituali in cima)",
  recent: "Ultima Visita (Più recenti in cima)",
};

export const firstOf = (c: Pick<Customer, "first_name" | "name">) => c.first_name?.trim() || c.name.trim().split(/\s+/)[0] || "";
export const lastOf = (c: Pick<Customer, "last_name" | "first_name" | "name">) =>
  c.last_name?.trim() || (c.first_name?.trim() ? "" : c.name.trim().split(/\s+/).slice(1).join(" "));
export const displayName = (c: Pick<Customer, "last_name" | "first_name" | "name">) => [lastOf(c), firstOf(c)].filter(Boolean).join(" ") || c.name;
export const fullName = (first: string, last: string) => [first.trim(), last.trim()].filter(Boolean).join(" ");
export const phonesOf = (c: Pick<Customer, "phone" | "extra_phones">) => [c.phone, ...(c.extra_phones ?? [])].map(normPhone).filter(Boolean);

export type CustomerStats = { visits: number; noShows: number; last: string | null };

/** Visite e No-Show di un cliente su tutti i suoi telefoni. */
export function customerRows(c: Pick<Customer, "phone" | "extra_phones">, rows: HistoryRow[]) {
  const ph = new Set(phonesOf(c));
  return ph.size ? rows.filter((r) => ph.has(normPhone(r.phone))) : [];
}

export function customerStats(c: Pick<Customer, "phone" | "extra_phones">, rows: HistoryRow[], ranges: Ranges, now: Date): CustomerStats {
  const past = customerRows(c, rows).filter((r) => r.no_show || serviceEnded(r, ranges, now));
  const visited = past.filter((r) => r.arrived).map((r) => r.date).sort();
  return { visits: visited.length, noShows: past.filter((r) => isNoShow(r, ranges, now)).length, last: visited.at(-1) ?? null };
}

export function matchesSearch(c: Customer, term: string) {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const digits = normPhone(t);
  const text = [c.name, c.first_name, c.last_name, ...(c.emails ?? [])].join(" ").toLowerCase();
  return text.includes(t) || (digits.length >= 2 && /^[\d+\s-]+$/.test(t) && phonesOf(c).some((p) => p.includes(digits)));
}

const coll = new Intl.Collator("it", { sensitivity: "base", numeric: true });
export function sortKey(c: Customer, mode: SortMode) { return mode === "first" ? firstOf(c) || lastOf(c) : lastOf(c) || firstOf(c); }
export function sortCustomers(list: Customer[], mode: SortMode, stats: Map<string, CustomerStats>) {
  return [...list].sort((a, b) => {
    const sa = stats.get(a.id), sb = stats.get(b.id);
    if (mode === "visits") { const d = (sb?.visits ?? 0) - (sa?.visits ?? 0); if (d) return d; }
    if (mode === "recent") { const d = (sb?.last ?? "").localeCompare(sa?.last ?? ""); if (d) return d; }
    return coll.compare(sortKey(a, mode === "first" ? "first" : "last"), sortKey(b, mode === "first" ? "first" : "last"));
  });
}
export const initialOf = (s: string) => {
  const ch = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
};

const DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
function mode<T>(vals: T[]): T | null {
  const m = new Map<T, number>();
  for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
  let best: T | null = null, n = 0;
  for (const [k, c] of m) if (c > n) { best = k; n = c; }
  return best;
}

/** Abitudini calcolate sulle visite effettuate (arrivato). */
export function habits(rows: (HistoryRow & { people?: number; table_ids?: string[] })[], tableName: (id: string) => string | undefined) {
  const v = rows.filter((r) => r.arrived);
  if (!v.length) return null;
  const day = mode(v.map((r) => new Date(`${r.date}T12:00:00Z`).getUTCDay()));
  const month = mode(v.map((r) => Number(r.date.slice(5, 7)) - 1));
  const table = mode(v.flatMap((r) => r.table_ids ?? []));
  const ppl = v.map((r) => r.people ?? 0).filter((n) => n > 0);
  return {
    day: day == null ? null : DAYS[day]!,
    shift: mode(v.map((r) => r.shift)),
    month: month == null ? null : MONTHS[month]!,
    table: table ? tableName(table) ?? null : null,
    avgPeople: ppl.length ? Math.round((ppl.reduce((a, b) => a + b, 0) / ppl.length) * 10) / 10 : null,
  };
}

/** Una prenotazione appartiene al cliente se è collegata per id o per uno dei suoi telefoni. */
export function isLinkedReservation(c: Pick<Customer, "id" | "phone" | "extra_phones">, r: { customer_id: string | null; phone: string | null }) {
  return r.customer_id === c.id || (!!normPhone(r.phone) && phonesOf(c).includes(normPhone(r.phone)));
}
