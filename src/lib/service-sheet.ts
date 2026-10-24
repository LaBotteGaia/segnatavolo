/** Elenco unico del servizio; a parità di ora conserva la sequenza di inserimento. */
export function chronologicalServiceRows<T extends { time: string | null; created_at?: string | null }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")
    || (a.created_at ?? "").localeCompare(b.created_at ?? ""));
}