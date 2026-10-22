/** Assegnazione intelligente del tavolo (logica pura, testata). */
import { canJoin, type RTable, type TableExtras, NO_EXTRAS } from "./data";
import { isRoomClosedFor, tableState, type RotationCfg } from "./rotation";

type T = Pick<RTable, "id" | "name" | "seats" | "x" | "y" | "room_id" | "no_join" | "allow_extras">;
type RoomLite = { id: string; environment?: string | null; open_days?: number[] | null; closed_periods?: unknown; closed_shifts?: string[] | null; walls?: unknown };
type Other = { id: string; name: string; table_ids: string[]; time: string; duration_min?: number | null; buffer_min?: number | null; no_show?: boolean };

export type Suggestion = { ids: string[]; extras: TableExtras; kind: "single" | "extension" | "join"; waste: number };

/** Sponde massime di testa per raggiungere i coperti. */
const MAX_SPONDE = 2;

export function suggestTables(p: {
  people: number; date: string; shift: string; time: string;
  tables: T[]; rooms: RoomLite[]; others: Other[]; cfg: RotationCfg;
  outside?: boolean; wallsFor: (roomId: string) => string[];
  me?: { id: string; duration_min?: number | null; buffer_min?: number | null };
}): Suggestion | null {
  const { people, tables, rooms, others, cfg } = p;
  if (!people || people < 1) return null;
  const me = { id: p.me?.id ?? "new", time: p.time, duration_min: p.me?.duration_min ?? null, buffer_min: p.me?.buffer_min ?? null };
  const openRooms = rooms.filter((r) => !isRoomClosedFor(r as never, p.date, p.shift));
  // Preferisce la zona richiesta (Fuori/Dentro); se non ci sono sale di quella zona usa tutte le aperte.
  const zone = p.outside === undefined ? openRooms : openRooms.filter((r) => (r.environment === "esterno") === p.outside);
  const roomIds = new Set((zone.length ? zone : openRooms).map((r) => r.id));
  // Libero = nessuna sovrapposizione oraria (rotazione/doppio turno inclusi).
  const free = tables.filter((t) => roomIds.has(t.room_id) && tableState(t.id, me, others, cfg).kind !== "busy");
  if (!free.length) return null;
  const bySize = (a: T, b: T) => a.seats - b.seats || a.name.localeCompare(b.name, "it", { numeric: true });

  // A. tavolo singolo perfetto
  const exact = free.filter((t) => t.seats === people).sort(bySize)[0];
  if (exact) return { ids: [exact.id], extras: NO_EXTRAS, kind: "single", waste: 0 };
  // B. prolunga con sponde su un tavolo poco più piccolo
  const ext = free.filter((t) => t.allow_extras && t.seats < people && people - t.seats <= MAX_SPONDE).sort((a, b) => b.seats - a.seats)[0];
  if (ext) return { ids: [ext.id], extras: { ...NO_EXTRAS, extra_sponde: people - ext.seats }, kind: "extension", waste: 0 };
  // A (eccedenza minima)
  const bigger = free.filter((t) => t.seats > people).sort(bySize)[0];
  if (bigger) return { ids: [bigger.id], extras: NO_EXTRAS, kind: "single", waste: bigger.seats - people };

  // C. unione di tavoli vicini nella stessa sala (rispetta no_join e muri)
  let best: (Suggestion & { dist: number }) | null = null;
  const consider = (combo: T[]) => {
    for (let i = 0; i < combo.length; i++) for (let j = i + 1; j < combo.length; j++) if (!canJoin(combo[i]!, combo[j]!, p.wallsFor)) return;
    // catena di adiacenza: ogni tavolo deve avere un vicino entro 1 cella (orizzontale/verticale preferiti)
    const near = (a: T, b: T) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (!combo.every((a) => combo.some((b) => b !== a && Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1))) return;
    const seats = combo.reduce((s, t) => s + t.seats, 0);
    const deficit = people - seats;
    let extras = NO_EXTRAS;
    if (deficit > 0) {
      if (deficit > MAX_SPONDE || !combo.some((t) => t.allow_extras)) return;
      extras = { ...NO_EXTRAS, extra_sponde: deficit };
    }
    const waste = Math.max(0, -deficit);
    let dist = 0;
    for (let i = 0; i < combo.length; i++) for (let j = i + 1; j < combo.length; j++) {
      const a = combo[i]!, b = combo[j]!;
      dist += near(a, b) + (a.x === b.x || a.y === b.y ? 0 : 0.5);
    }
    const cand = { ids: combo.map((t) => t.id), extras, kind: "join" as const, waste, dist };
    const score = (s: Suggestion & { dist: number }) => [s.ids.length, s.waste + s.extras.extra_sponde * 0.5, s.dist];
    if (!best) { best = cand; return; }
    const a = score(cand), b = score(best);
    for (let k = 0; k < a.length; k++) { if (a[k]! < b[k]!) { best = cand; return; } if (a[k]! > b[k]!) return; }
  };
  const groups = new Map<string, T[]>();
  for (const t of free) groups.set(t.room_id, [...(groups.get(t.room_id) ?? []), t]);
  for (const g of groups.values()) {
    const n = Math.min(g.length, 16);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      consider([g[i]!, g[j]!]);
      for (let k = j + 1; k < n; k++) {
        consider([g[i]!, g[j]!, g[k]!]);
        for (let l = k + 1; l < n; l++) consider([g[i]!, g[j]!, g[k]!, g[l]!]);
      }
    }
  }
  if (!best) return null;
  const { dist: _d, ...s } = best as Suggestion & { dist: number };
  return s;
}
