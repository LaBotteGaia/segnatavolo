/** Assegnazione intelligente del tavolo (logica pura, testata). */
import { canJoin, type RTable, type TableExtras, NO_EXTRAS } from "./data";
import { isRoomClosedFor, tableState, type RotationCfg } from "./rotation";
import { assignmentPreference, protectSmallParty, DEFAULT_ASSIGNMENT_RULES, type AssignmentRules } from './assignment-rules';

type T = Pick<RTable, "id" | "name" | "seats" | "x" | "y" | "room_id" | "no_join" | "allow_extras"> & Partial<Pick<RTable, 'accoppiabile' | 'adatto_seduta_lunga' | 'coperti_comodi' | 'coperti_max' | 'posti_scomodi_solo_in_unione' | 'ordine_riempimento'>>;
type RoomLite = { id: string; environment?: string | null; open_days?: number[] | null; closed_periods?: unknown; closed_shifts?: string[] | null; walls?: unknown };
type Other = { id: string; name: string; table_ids: string[]; time: string; duration_min?: number | null; buffer_min?: number | null; no_show?: boolean };

export type Suggestion = { ids: string[]; extras: TableExtras; kind: "single" | "extension" | "join"; waste: number };

/** Una sponda di testa per ciascun tavolo abilitato, solo oltre 8 pax. */
export function suggestTables(p: {
  people: number; date: string; shift: string; time: string;
  tables: T[]; rooms: RoomLite[]; others: Other[]; cfg: RotationCfg;
  outside?: boolean | undefined; wallsFor: (roomId: string) => string[];
  me?: { id: string; duration_min?: number | null; buffer_min?: number | null };
  rules?: AssignmentRules; notes?: string | undefined;
}): Suggestion | null {
  if (!Number.isFinite(p.people) || p.people < 1) return null;
  const me = { id: p.me?.id ?? "new", time: p.time, duration_min: p.me?.duration_min ?? null, buffer_min: p.me?.buffer_min ?? null };
  const rules = p.rules ?? DEFAULT_ASSIGNMENT_RULES;
  const preference = (t: T) => assignmentPreference(t, { ...me, notes: p.notes ?? '' }, rules, p.rooms);
  const comfort = (t: T) => t.coperti_comodi ?? t.seats;
  const openRooms = p.rooms.filter(r => !isRoomClosedFor(r as never, p.date, p.shift));
  const zone = p.outside === undefined ? openRooms : openRooms.filter(r => (r.environment === "esterno") === p.outside);
  const roomIds = new Set((zone.length ? zone : openRooms).map(r => r.id));
  const free = p.tables.filter(t => roomIds.has(t.room_id) && tableState(t.id, me, p.others, p.cfg).kind !== "busy");
  const single = protectSmallParty(free.filter(t => comfort(t) >= p.people), p.people, rules).sort((a,b) => preference(a)-preference(b) || comfort(a)-comfort(b) || (a.ordine_riempimento ?? 10)-(b.ordine_riempimento ?? 10) || a.name.localeCompare(b.name, "it", { numeric: true }))[0];
  if (single && p.people <= 8) return { ids: [single.id], extras: NO_EXTRAS, kind: "single", waste: comfort(single)-p.people };
  type Candidate = Suggestion & { distance: number };
  let plain: Candidate | undefined;
  let extended: Candidate | undefined;
  const score = (s: Candidate) => [s.ids.reduce((n,id) => { const t=p.tables.find(t=>t.id===id); return n+(t?preference(t):0); },0), s.extras.extra_sponde, s.ids.length, s.waste, s.distance];
  const better = (a: Candidate, b?: Candidate) => {
    if (!b) return true;
    const left = score(a), right = score(b);
    for (const [i, v] of left.entries()) {
      const other = right[i] ?? 0;
      if (v !== other) return v < other;
    }
    return false;
  };
  const adjacent = (a: T, b: T) => Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)) <= 1;
  const connected = (combo: T[]) => {
    const first = combo[0]; if (!first) return false;
    const seen = new Set([first]);
    for (const a of seen) for (const b of combo) if (!seen.has(b) && adjacent(a,b)) seen.add(b);
    return seen.size === combo.length;
  };
  const consider = (combo: T[], seats: number) => {
    if (combo.length === 1 && seats >= p.people) return;
    if (!connected(combo)) return;
    const deficit = Math.max(0, p.people-seats);
    if (deficit && (p.people <= 8 || deficit > combo.filter(t => t.allow_extras).length)) return;
    const candidate: Candidate = {
      ids: combo.map(t => t.id), extras: deficit ? { ...NO_EXTRAS, extra_sponde: deficit } : NO_EXTRAS,
      kind: combo.length === 1 ? "extension" : "join", waste: Math.max(0,seats-p.people),
      distance: combo.reduce((sum,a) => sum+combo.reduce((d,b) => d+Math.abs(a.x-b.x)+Math.abs(a.y-b.y),0),0),
    };
    if (deficit) { if (better(candidate,extended)) extended=candidate; }
    else if (better(candidate,plain)) plain=candidate;
  };
  const groups = new Map<string,T[]>();
  for (const t of free) groups.set(t.room_id,[...(groups.get(t.room_id)??[]),t]);
  for (const group of groups.values()) {
    // Expand connected sets only, without limiting unions to four physical tables.
    const visited = new Set<string>();
    const explore = (combo: T[], seats: number) => {
      const key = combo.map(t=>t.id).sort().join("|");
      if (visited.has(key)) return;
      visited.add(key); consider(combo,seats);
      if (seats >= p.people) return;
      for (const next of group) {
        if (combo.includes(next) || !combo.some(t=>adjacent(t,next)) || !combo.every(t=>canJoin(t,next,p.wallsFor))) continue;
        explore([...combo,next],seats+comfort(next));
      }
    };
    for (const t of group) explore([t],comfort(t));
  }
  if (!plain && single) return { ids: [single.id], extras: NO_EXTRAS, kind: "single", waste: comfort(single)-p.people };
  const best = plain ?? extended;
  if (!best) {
    const tight=free.filter(t=>t.posti_scomodi_solo_in_unione===false && (t.coperti_max ?? comfort(t))>=p.people).sort((a,b)=>preference(a)-preference(b) || (a.coperti_max ?? comfort(a))-(b.coperti_max ?? comfort(b)))[0];
    return tight ? {ids:[tight.id],extras:NO_EXTRAS,kind:'single',waste:(tight.coperti_max ?? comfort(tight))-p.people} : null;
  }
  const { distance: _distance, ...suggestion } = best;
  return suggestion;
}
