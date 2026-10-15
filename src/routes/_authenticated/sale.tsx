import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RestaurantGate } from "@/components/RestaurantGate";
import { useMembership } from "@/lib/membership";
import { cn } from "@/lib/utils";
import { useRooms, useTables, type RTable } from "@/lib/data";
import { GRID_COLS, GRID_ROWS } from "@/components/agenda/TableDialog";

export const Route = createFileRoute("/_authenticated/sale")({
  head: () => ({
    meta: [
      { title: "Configura Sale — Prenotazioni" },
      { name: "description", content: "Crea le sale e disponi i tavoli sulla mappa." },
      { property: "og:title", content: "Configura Sale — Prenotazioni" },
      { property: "og:description", content: "Crea le sale e disponi i tavoli sulla mappa." },
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
  const { data: rooms = [] } = useRooms();
  const { data: tables = [] } = useTables();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [newRoom, setNewRoom] = useState("");
  const room = rooms.find((r) => r.id === (roomId ?? rooms[0]?.id));
  const roomTables = tables.filter((t) => t.room_id === room?.id);
  const selected = tables.find((t) => t.id === sel);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["tables"] });
  };

  const addRoom = async () => {
    if (!newRoom.trim()) return;
    const { data } = await supabase.from("rooms").insert({ name: newRoom.trim(), sort_order: rooms.length }).select().single();
    setNewRoom("");
    if (data) setRoomId(data.id);
    refresh();
  };

  const cellClick = async (x: number, y: number) => {
    if (!room) return;
    const t = roomTables.find((tt) => tt.x === x && tt.y === y);
    if (t) return setSel(t.id === sel ? null : t.id);
    if (selected && selected.room_id === room.id) {
      await supabase.from("restaurant_tables").update({ x, y }).eq("id", selected.id);
    } else {
      const n = roomTables.length + 1;
      const { data } = await supabase.from("restaurant_tables").insert({ room_id: room.id, name: `T${n}`, seats: 4, x, y }).select().single();
      if (data) setSel(data.id);
    }
    refresh();
  };

  const updateTable = async (t: RTable, patch: Partial<RTable>) => {
    qc.setQueryData<RTable[]>(["tables"], (old) => old?.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    await supabase.from("restaurant_tables").update(patch).eq("id", t.id);
  };

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <Button asChild variant="secondary" size="sm" className="mb-4">
          <Link to="/agenda"><ArrowLeft /> Torna all'agenda</Link>
        </Button>
        <div className="paper-page rounded-md py-6 pl-14 pr-4 sm:pr-8">
          <h1 className="font-display text-3xl text-primary">Configura Sale</h1>
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
                <Input
                  key={room.id}
                  defaultValue={room.name}
                  className="h-9 w-48 font-display"
                  onBlur={async (e) => {
                    if (e.target.value.trim() && e.target.value !== room.name) {
                      await supabase.from("rooms").update({ name: e.target.value.trim() }).eq("id", room.id);
                      refresh();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm(`Eliminare la sala "${room.name}" e tutti i suoi tavoli?`)) return;
                    await supabase.from("rooms").delete().eq("id", room.id);
                    setRoomId(null);
                    refresh();
                  }}
                >
                  <Trash2 /> Elimina sala
                </Button>
              </div>

              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0,1fr))` }}>
                {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
                  const x = i % GRID_COLS, y = Math.floor(i / GRID_COLS);
                  const t = roomTables.find((tt) => tt.x === x && tt.y === y);
                  return (
                    <button
                      key={i}
                      onClick={() => cellClick(x, y)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md text-sm font-bold",
                        t ? "bg-free text-free-foreground" : "border border-dashed border-rule text-muted-foreground/40 hover:bg-accent",
                        t && t.id === sel && "ring-4 ring-primary ring-offset-2 ring-offset-paper",
                      )}
                    >
                      {t ? `${t.name} - ${t.seats}p` : "+"}
                    </button>
                  );
                })}
              </div>

              {selected && selected.room_id === room.id && (
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border bg-card p-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Nome tavolo</label>
                    <Input className="w-28" value={selected.name} onChange={(e) => updateTable(selected, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Posti</label>
                    <Input className="w-20" type="number" min={1} value={selected.seats} onChange={(e) => updateTable(selected, { seats: Math.max(1, Number(e.target.value) || 1) })} />
                  </div>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await supabase.from("restaurant_tables").delete().eq("id", selected.id);
                      setSel(null);
                      refresh();
                      toast("Tavolo eliminato");
                    }}
                  >
                    <Trash2 /> Elimina tavolo
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
