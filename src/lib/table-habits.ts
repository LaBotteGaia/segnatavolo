/** Apprendimento abitudini di sala: finestra mobile di 30 giorni sulle scelte effettive per turno e numero di coperti. */
export const HABIT_WINDOW_DAYS = 30;
export const HABIT_MIN_COUNT = 2;
export type HabitRow = { date: string; shift: string; people: number; table_ids: string[]; no_show?: boolean | null };
export type TableHabits = Record<string, Record<string, number>>;

export const habitBucket = (people: number) => Math.min(Math.max(1, Math.round(people)), 9);
export const habitKey = (shift: string, people: number) => `${shift}|${habitBucket(people)}`;

/** Data ISO di inizio finestra (inclusa) rispetto a `today` (YYYY-MM-DD). */
export function habitWindowStart(today: string): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - HABIT_WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

/** Conta quante volte ogni combinazione di tavoli è stata usata, solo nei 30 giorni precedenti a oggi. */
export function learnHabits(rows: HabitRow[], today: string): TableHabits {
  const from = habitWindowStart(today), out: TableHabits = {};
  for (const r of rows) {
    if (r.no_show || !r.table_ids?.length || r.date < from || r.date >= today) continue;
    const k = habitKey(r.shift, r.people), combo = [...r.table_ids].sort().join('+');
    (out[k] ??= {})[combo] = (out[k][combo] ?? 0) + 1;
  }
  return out;
}

/** Punteggio di affinità (più alto = più abituale); 0 sotto la soglia minima per evitare scelte casuali. */
export function habitScore(habits: TableHabits | undefined, shift: string, people: number, ids: string[]): number {
  const n = habits?.[habitKey(shift, people)]?.[[...ids].sort().join('+')] ?? 0;
  return n >= HABIT_MIN_COUNT ? n : 0;
}
