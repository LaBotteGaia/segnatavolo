import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { RestaurantGate } from "@/components/RestaurantGate";
import { useMembership, useSettings } from "@/lib/membership";
import { useActiveRestaurantId } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { activeShifts, shiftName, roomCapacity, totalCapacities, useRooms, useTables, type RTable, type Room, wallsOf, toggleWall, gridOf, wallBetween, isObstacle, obstacleKey } from "@/lib/data";
import { RoomGrid } from "@/components/agenda/RoomGrid";
import { useEffect } from "react";
import { validTableName } from "@/lib/extras";
import { doubleShiftRulesOf, periodsOf, type ClosedPeriod, type DoubleShiftRule } from "@/lib/rotation";
import { configurationError } from '@/lib/assignment-rules';
import { Switch } from '@/components/ui/switch';

export const Route = createFileRoute("/_authenticated/sale")({
  head: () => ({
    meta: [
      { title: "Gestione Sale — Segnatavolo" },
      { name: "description", content: "Crea le sale e disponi i tavoli sulla mappa." },
      { property: "og:title", content: "Gestione Sale — Segnatavolo" },
      { property: "og:description", content: "Crea le sale e disponi i tavoli sulla mappa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RestaurantGate>
      <MasterOnly />
    </RestaurantGate>
  ),
});

function MasterOnly() {
  const { data: me } = useMembership();
  if (me?.role !== "master") return <Navigate to="/agenda" />;
  return <SalePage />;
}

function SalePage() {
  const qc = useQueryClient();
  const restaurantId = useActiveRestaurantId();
  const { data: rooms = [] } = useRooms();
  const { data: tables = [] } = useTables();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [newRoom, setNewRoom] = useState("");
  const [drawWalls, setDrawWalls] = useState(false);
  const [drawObs, setDrawObs] = useState(false);
  const room = rooms.find((r) => r.id === (roomId ?? rooms[0]?.id));
  const roomTables = tables.filter((t) => t.room_id === room?.id);
  const selected = tables.find((t) => t.id === sel);

  const locked = room?.locked ?? true;
  const grid = gridOf(room);
  const resize = (dc: number, dr: number) => {
    if (!room || locked) return;
    const cols = Math.min(60, grid.cols + dc), rows = Math.min(60, grid.rows + dr);
    if (cols < 1 || rows < 1) return;
    if (roomTables.some((t) => t.x >= cols || t.y >= rows)) { toast.error("Sposta prima i tavoli che stanno nell'ultima riga/colonna"); return; }
    updateRoom(room, { grid_cols: cols, grid_rows: rows });
  };
  const caps = totalCapacities(rooms, tables);
  const updateRoom = async (r: Room, patch: Partial<Room>) => {
    qc.setQueryData<Room[]>(["rooms", restaurantId], (old) => old?.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("rooms").update(patch).eq("id", r.id).eq("restaurant_id", restaurantId ?? "");
    if (error) toast.error(configurationError(error));
    else if (["open_days", "closed_shifts", "closed_periods", "double_shifts"].some((key) => key in patch)) toast.success("Configurazione servizi salvata");
    refresh();
  };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["tables"] });
  };

  const moveRoom = async (r: Room, dir: -1 | 1) => {
    const i = rooms.findIndex((x) => x.id === r.id), j = i + dir;
    if (i < 0 || j < 0 || j >= rooms.length) return;
    const next = [...rooms];
    const [moved] = next.splice(i, 1);
    if (!moved) return;
    next.splice(j, 0, moved);
    const ordered = next.map((x, k) => ({ ...x, sort_order: k }));
    qc.setQueryData<Room[]>(["rooms", restaurantId], ordered);
    const results = await Promise.all(ordered.map((x) => supabase.from("rooms").update({ sort_order: x.sort_order }).eq("id", x.id).eq("restaurant_id", restaurantId ?? "")));
    if (results.some((x) => x.error)) toast.error("Ordine delle sale non salvato");
    refresh();
  };

  const addRoom = async () => {
    if (!newRoom.trim()) return;
      const assist = restaurantId;
      const { data } = await supabase.from("rooms").insert({ name: newRoom.trim(), sort_order: rooms.length, ...(assist ? { restaurant_id: assist } : {}) }).select().single();
    setNewRoom("");
    if (data) setRoomId(data.id);
    refresh();
  };

  const cellClick = async (x: number, y: number) => {
    if (!room) return;
    const t = roomTables.find((tt) => tt.x === x && tt.y === y);
    if (t) { if (drawObs && !locked) { toast.error("Qui c'è un tavolo: spostalo prima di inserire un ostacolo"); return; } return setSel(t.id === sel ? null : t.id); }
    if (locked) { toast("🔒 Sala protetta da modifiche: sbloccala per cambiare la mappa"); return; }
    if (drawObs) { updateRoom(room, { walls: toggleWall(wallsOf(room), obstacleKey(x, y)) }); return; }
    if (isObstacle(wallsOf(room), x, y)) { toast.error("🚫 Questa casella è un ostacolo: non può contenere un tavolo"); return; }
    if (selected && selected.room_id === room.id) {
      await supabase.from("restaurant_tables").update({ x, y }).eq("id", selected.id).eq("restaurant_id", restaurantId ?? "");
    } else {
      const n = roomTables.length + 1;
      const { data } = await supabase.from("restaurant_tables").insert({ restaurant_id: restaurantId, room_id: room.id, name: `T${n}`, seats: 4, coperti_comodi: 4, coperti_max: 4, x, y }).select().single();
      if (data) setSel(data.id);
    }
    refresh();
  };

  const updateTable = async (t: RTable, patch: Partial<RTable>) => {
    qc.setQueryData<RTable[]>(["tables", restaurantId], (old) => old?.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    const {data,error} = await supabase.from("restaurant_tables").update(patch).eq("id", t.id).eq("restaurant_id", restaurantId ?? "").select('id');
    if(error || !data?.length) toast.error(configurationError(error ?? {code:'42501'}));
    else toast.success('Tavolo salvato');
    refresh();
  };

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <div className="w-full max-w-none">
        <Button asChild variant="secondary" size="sm" className="mb-4">
          <Link to="/agenda"><ArrowLeft /> Torna all'agenda</Link>
        </Button>
        <div className="paper-page rounded-md py-6 pl-14 pr-4 sm:pr-8">
          <h1 className="font-display text-3xl text-primary">Gestione Sale e Mappe</h1>
          <div className="mb-3 flex flex-wrap gap-4 text-sm"><span>Capienza totale interna: <b>{caps.inside}</b></span><span>Capienza totale esterna: <b>{caps.outside}</b></span></div>
          <p className="mb-4 font-hand text-lg text-muted-foreground">Tocca una casella vuota per aggiungere un tavolo. Seleziona un tavolo e tocca una casella vuota per spostarlo.</p>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => { setRoomId(r.id); setSel(null); }}
                className={cn("rounded-md border px-3 py-1.5 font-display", r.id === room?.id ? "bg-primary text-primary-foreground" : "bg-card")}
              >
                {r.name}
              </button>
            ))}
            <div className="flex gap-1">
              <Input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="Nuova sala" className="h-9 w-36" onKeyDown={(e) => e.key === "Enter" && addRoom()} />
              <Button size="sm" onClick={addRoom}><Plus /></Button>
            </div>
          </div>

          {room && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={rooms[0]?.id === room.id} onClick={() => moveRoom(room, -1)}>⬆️ Sposta su</Button>
                <Button size="sm" variant="outline" disabled={rooms[rooms.length - 1]?.id === room.id} onClick={() => moveRoom(room, 1)}>⬇️ Sposta giù</Button>
                <Input
                  key={room.id}
                  defaultValue={room.name}
                  className="h-9 w-48 font-display"
                  onBlur={async (e) => {
                    if (e.target.value.trim() && e.target.value !== room.name) {
                      await supabase.from("rooms").update({ name: e.target.value.trim() }).eq("id", room.id).eq("restaurant_id", restaurantId ?? "");
                      refresh();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm(`Eliminare la sala "${room.name}" e tutti i suoi tavoli?`)) return;
                    await supabase.from("rooms").delete().eq("id", room.id).eq("restaurant_id", restaurantId ?? "");
                    setRoomId(null);
                    refresh();
                  }}
                >
                  <Trash2 /> Elimina sala
                </Button>
              </div>
              <div className={cn("mb-3 flex flex-wrap items-center gap-2 rounded-md border p-2", locked ? "border-primary/40 bg-primary/5" : "border-warning bg-warning/15")}>
                <Button size="sm" variant={locked ? "default" : "outline"} onClick={() => { updateRoom(room, { locked: !locked }); setDrawWalls(false); setDrawObs(false); }}>
                  {locked ? "🔓 Sblocca Sala" : "🔒 Blocca Sala"}
                </Button>
                <span className="text-sm font-semibold">{locked ? "🔒 Sala protetta da modifiche" : "✏️ Sala sbloccata: modifiche attive"}</span>
              </div>
              <fieldset disabled={locked} className={cn("contents", locked && "[&_button]:opacity-50")}>
              <div className="mb-4 flex flex-wrap items-end gap-4 rounded-md border bg-card p-3">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Tipologia Sala</div>
                  <div className="flex gap-1">
                    {(["interno", "esterno"] as const).map((env) => (
                      <button key={env} onClick={() => updateRoom(room, { environment: env, is_outdoor: env === "esterno" })}
                        className={cn("rounded-md border px-3 py-1.5 text-sm", room.environment === env ? "bg-primary text-primary-foreground" : "bg-paper")}>
                        {env === "interno" ? "🏠 Interna" : "🌳 Esterna / Dehors / Veranda"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Capienza massima coperti per turno</div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={room.capacity === null}
                        onChange={(e) => updateRoom(room, { capacity: e.target.checked ? null : roomCapacity(room, tables) })} />
                      Automatica (somma posti tavoli)
                    </label>
                    <NumberInput key={room.id + String(room.capacity === null)} min={0} className="h-9 w-24"
                      disabled={room.capacity === null} value={room.capacity ?? roomCapacity(room, tables)}
                      onCommit={(capacity) => room.capacity !== null && updateRoom(room, { capacity })} />
                  </div>
                </div>
              </div>
              </fieldset>
              <RoomSchedule room={room} onChange={(p) => updateRoom(room, p)} />
              <fieldset disabled={locked} className={cn("contents", locked && "[&_button]:opacity-50")}>


              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant={drawWalls ? "default" : "outline"} onClick={() => { setDrawWalls((w) => !w); setDrawObs(false); setSel(null); }}>
                  🧱 Disegna Pareti {drawWalls ? "(attivo)" : ""}
                </Button>
                <Button size="sm" variant={drawObs ? "default" : "outline"} onClick={() => { setDrawObs((w) => !w); setDrawWalls(false); setSel(null); }}>
                  🚫 Inserisci Ostacolo {drawObs ? "(attivo)" : ""}
                </Button>
                {drawObs && <span className="text-sm text-muted-foreground">Tocca una casella libera per segnare un ostacolo (colonna, pilastro, albero…); ritoccala per toglierlo.</span>}
                {drawWalls && <span className="text-sm text-muted-foreground">Tocca un bordo tra le caselle per tracciare un muro; ritoccalo per toglierlo.</span>}
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-1 text-sm">
                <span className="mr-1 font-semibold">Griglia {grid.cols}×{grid.rows}</span>
                <Button size="sm" variant="outline" onClick={() => resize(0, 1)}>+ Riga</Button>
                <Button size="sm" variant="outline" onClick={() => resize(0, -1)}>- Riga</Button>
                <Button size="sm" variant="outline" onClick={() => resize(1, 0)}>+ Colonna</Button>
                <Button size="sm" variant="outline" onClick={() => resize(-1, 0)}>- Colonna</Button>
              </div>
              </fieldset>
              <RoomGrid
                cols={grid.cols}
                rows={grid.rows}
                tables={roomTables}
                walls={wallsOf(room)}
                editWalls={drawWalls && !locked}
                onToggleWall={(k) => updateRoom(room, { walls: toggleWall(wallsOf(room), k) })}
                renderCell={(x, y, t) => (
                  <button
                    onClick={() => !drawWalls && cellClick(x, y)}
                    className={cn(
                      "relative flex h-full w-full items-center justify-center overflow-hidden rounded-md text-center font-bold leading-tight",
                      t ? "bg-free text-free-foreground" : "border border-dashed border-rule text-muted-foreground/40 hover:bg-accent",
                      t && t.id === sel && "ring-4 ring-primary ring-offset-2 ring-offset-paper",
                      drawWalls && "opacity-60",
                    )}
                  >
                    {t ? `${t.name} - ${t.seats}p` : drawWalls || drawObs || isObstacle(wallsOf(room), x, y) ? "" : "+"}
                    {t && !t.allow_extras && <span className="absolute right-0.5 top-0 text-[0.8em]" title="Niente sponde/barelle">⛔</span>}
                  </button>
                )}
              />

              {selected && selected.room_id === room.id && (
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border bg-card p-3">
                  <fieldset disabled={locked} className="contents">
                  <TableFields key={selected.id} t={selected} onSave={(p) => updateTable(selected, p)} />
                  <div className="w-full space-y-2 border-t pt-3">
                    <div className="font-display text-lg">Regole e Vincoli Speciali</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selected.allow_extras} onChange={(e) => updateTable(selected, { allow_extras: e.target.checked })} />
                      Consente l'inserimento di sponde / barelle
                    </label>
                    <div className="text-sm">Non abbinabile con:</div>
                    <div className="flex flex-wrap gap-1">
                      {roomTables.filter((o) => o.id !== selected.id).map((o) => {
                        const byWall = wallBetween(selected, o, wallsOf(room));
                        const on = byWall || selected.no_join.includes(o.id) || o.no_join.includes(selected.id);
                        return (
                          <button key={o.id} type="button" disabled={byWall} title={byWall ? "Parete o ostacolo tra i tavoli" : undefined}
                            onClick={() => {
                              const add = !on;
                              updateTable(selected, { no_join: add ? [...selected.no_join, o.id] : selected.no_join.filter((i) => i !== o.id) });
                              if (!add && o.no_join.includes(selected.id)) updateTable(o, { no_join: o.no_join.filter((i) => i !== selected.id) });
                            }}
                            className={cn("rounded-md border px-2 py-1 text-sm", on ? "border-busy bg-busy text-busy-foreground" : "bg-paper", byWall && "opacity-70")}>
                            {o.name}{byWall ? " 🧱" : ""}
                          </button>
                        );
                      })}
                      {roomTables.length < 2 && <span className="text-xs text-muted-foreground">Nessun altro tavolo in questa sala.</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">🧱 = parete disegnata tra i due tavoli: non abbinabili in automatico.</p>
                  </div>
                  <Button
                    variant="destructive" disabled={locked}
                    onClick={async () => {
                      await supabase.from("restaurant_tables").delete().eq("id", selected.id).eq("restaurant_id", restaurantId ?? "");
                      setSel(null);
                      refresh();
                      toast("Tavolo eliminato");
                    }}
                  >
                    <Trash2 /> Elimina tavolo
                  </Button>
                  </fieldset>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TableFields({ t, onSave }: { t: RTable; onSave: (p: Partial<RTable>) => void }) {
  const [name, setName] = useState(t.name);
  const [comodi, setComodi] = useState(String(t.coperti_comodi ?? t.seats));
  const [max, setMax] = useState(String(t.coperti_max ?? t.seats));
  const [ordine, setOrdine] = useState(String(t.ordine_riempimento ?? 10));
  const [bad, setBad] = useState<{ name?: boolean; comodi?: boolean; max?: boolean; ordine?: boolean }>({});
  useEffect(() => { setName(t.name); setComodi(String(t.coperti_comodi ?? t.seats)); setMax(String(t.coperti_max ?? t.seats)); setOrdine(String(t.ordine_riempimento ?? 10)); }, [t.name, t.seats, t.coperti_comodi, t.coperti_max, t.ordine_riempimento]);
  const save = () => {
    const c = Number(comodi), m = Number(max), o = Number(ordine);
    const b = {
      name: !validTableName(name),
      comodi: !Number.isInteger(c) || c < 1 || c > 20,
      max: !Number.isInteger(m) || m < c || m > 20,
      ordine: !Number.isInteger(o) || o < 1 || o > 99,
    };
    setBad(b);
    if (b.name || b.comodi || b.max || b.ordine) { toast.error("Inserisci valori validi: coperti max non inferiori ai comodi, ordine tra 1 e 99"); return; }
    if (name.trim() !== t.name || c !== t.coperti_comodi || m !== t.coperti_max || o !== t.ordine_riempimento) {
      onSave({ name: name.trim(), seats: c, coperti_comodi: c, coperti_max: m, ordine_riempimento: o });
    }
  };
  const err = "border-destructive ring-1 ring-destructive";
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-xs text-muted-foreground">Nome tavolo</label>
        <Input className={cn("w-28", bad.name && err)} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Coperti comodi</label>
        <Input className={cn("w-20", bad.comodi && err)} inputMode="numeric" value={comodi} onChange={(e) => setComodi(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Coperti max</label>
        <Input className={cn("w-20", bad.max && err)} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Ordine riempimento (1-99)</label>
        <Input className={cn("w-20", bad.ordine && err)} inputMode="numeric" value={ordine} onChange={(e) => setOrdine(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm" title="Se attivo, i coperti oltre quelli comodi si attivano solo quando il tavolo è unito a un tavolo contiguo">
        <input type="checkbox" checked={t.posti_scomodi_solo_in_unione ?? true} onChange={(e) => onSave({ posti_scomodi_solo_in_unione: e.target.checked })} />
        Posti scomodi solo in unione
      </label>
      <Button size="sm" onClick={save}>Conferma</Button>
      <label className="flex w-full items-center justify-between gap-3 text-sm">Accoppiabile / componibile<Switch aria-label="Accoppiabile" checked={t.accoppiabile} onCheckedChange={accoppiabile=>onSave({accoppiabile})}/></label>
      <label className="flex w-full items-center justify-between gap-3 text-sm">Adatto a Seduta Lunga<Switch aria-label="Adatto a Seduta Lunga" checked={t.adatto_seduta_lunga} onCheckedChange={adatto_seduta_lunga=>onSave({adatto_seduta_lunga})}/></label>
      {(bad.name || bad.comodi || bad.max || bad.ordine) && <p className="w-full text-sm font-semibold text-destructive">Inserisci valori validi: coperti max non inferiori ai comodi, ordine tra 1 e 99</p>}
    </div>
  );
}

const DAYS: [number, string][] = [[1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Gio"], [5, "Ven"], [6, "Sab"], [0, "Dom"]];

/** Apertura settimanale e chiusure stagionali (ricorrenti ogni anno) della sala. */
function RoomSchedule({ room, onChange }: { room: Room; onChange: (p: Partial<Room>) => void }) {
  const settings = useSettings();
  const days = room.open_days ?? [0, 1, 2, 3, 4, 5, 6];
  const [draft, setDraft] = useState<ClosedPeriod[]>(periodsOf(room));
  useEffect(() => setDraft(periodsOf(room)), [room.id, JSON.stringify(room.closed_periods)]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (list: ClosedPeriod[]) => { setDraft(list); if (list.every((p) => p.from && p.to)) onChange({ closed_periods: list }); };
  return (
    <div className="mb-4 space-y-3 rounded-md border bg-card p-3">
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Turni in cui la sala è attiva</div>
        <div className="flex flex-wrap gap-3">
          {activeShifts(settings).map((s) => {
            const off = (room.closed_shifts ?? []).includes(s);
            return (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-5" checked={!off}
                  onChange={() => onChange({ closed_shifts: off ? (room.closed_shifts ?? []).filter((x) => x !== s) : [...(room.closed_shifts ?? []), s] })} />
                {shiftName(s)}
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Giorni settimanali di apertura</div>
        <div className="flex flex-wrap gap-1">
          {DAYS.map(([d, l]) => (
            <Button key={d} type="button" variant="outline" aria-pressed={days.includes(d)} onClick={() => onChange({ open_days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] })}
              className={cn("rounded-md border px-2.5 py-1 text-sm", days.includes(d) ? "bg-primary text-primary-foreground" : "bg-paper text-muted-foreground line-through")}>{l}</Button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Periodi stagionali di chiusura (si ripetono ogni anno, es. 1 novembre → 31 marzo)</div>
        {draft.map((p, i) => (
          <div key={i} className="mb-1 flex items-center gap-2">
            <span className="text-xs">dal</span>
            <Input type="date" className="h-9" value={p.from ? `2026-${p.from}` : ""} onChange={(e) => save(draft.map((x, j) => (j === i ? { ...x, from: e.target.value.slice(5) } : x)))} />
            <span className="text-xs">al</span>
            <Input type="date" className="h-9" value={p.to ? `2026-${p.to}` : ""} onChange={(e) => save(draft.map((x, j) => (j === i ? { ...x, to: e.target.value.slice(5) } : x)))} />
            <Button type="button" size="icon" variant="ghost" aria-label="Rimuovi periodo" onClick={() => save(draft.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => setDraft([...draft, { from: "", to: "" }])}>❄️ Aggiungi chiusura stagionale</Button>
      </div>
      <DoubleShiftRules room={room} onChange={onChange} />
    </div>
  );
}

/** Regole di doppio turno: la capienza della sala raddoppia nelle date/turni indicati. */
function DoubleShiftRules({ room, onChange }: { room: Room; onChange: (p: Partial<Room>) => void }) {
  const settings = useSettings();
  const rules = doubleShiftRulesOf(room);
  const save = (list: DoubleShiftRule[]) => onChange({ double_shifts: list as unknown as Room["double_shifts"] });
  const setRule = (i: number, patch: Partial<DoubleShiftRule>) => save(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="border-t pt-3">
      <div className="mb-1 text-xs text-muted-foreground">Doppio turno: la sala lavora su due rotazioni complete, quindi la sua capienza conta doppia nel calcolo dell'affluenza</div>
      {rules.map((r, i) => {
        const allYear = !r.from && !r.to;
        return (
          <div key={i} className="mb-2 space-y-2 rounded-md border bg-paper p-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={allYear} onChange={(e) => setRule(i, e.target.checked ? { from: "", to: "" } : { from: "06-01", to: "09-15" })} />
                Tutto l'anno
              </label>
              {!allYear && (
                <>
                  <span className="text-xs">dal</span>
                  <Input type="date" className="h-9" value={r.from ? `2026-${r.from}` : ""} onChange={(e) => setRule(i, { from: e.target.value.slice(5) })} />
                  <span className="text-xs">al</span>
                  <Input type="date" className="h-9" value={r.to ? `2026-${r.to}` : ""} onChange={(e) => setRule(i, { to: e.target.value.slice(5) })} />
                </>
              )}
              <Button type="button" size="icon" variant="ghost" aria-label="Rimuovi regola" onClick={() => save(rules.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">Giorni:</span>
              {DAYS.map(([d, l]) => (
                <Button key={d} type="button" variant="outline" aria-pressed={r.days.includes(d)} onClick={() => setRule(i, { days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] })}
                  className={cn("rounded-md border px-2 py-0.5 text-xs", r.days.includes(d) ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>{l}</Button>
              ))}
              {r.days.length === 0 && <span className="text-xs text-muted-foreground">(nessun giorno selezionato = tutti i giorni)</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">Turni:</span>
              {activeShifts(settings).map((s) => (
                <label key={s} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={r.shifts.includes(s)}
                    onChange={() => setRule(i, { shifts: r.shifts.includes(s) ? r.shifts.filter((x) => x !== s) : [...r.shifts, s] })} />
                  {shiftName(s)}
                </label>
              ))}
            </div>
          </div>
        );
      })}
      <Button type="button" size="sm" variant="outline" onClick={() => save([...rules, { from: "", to: "", days: [5, 6, 0], shifts: ["sera"] }])}>🔁 Aggiungi regola doppio turno</Button>
    </div>
  );
}
