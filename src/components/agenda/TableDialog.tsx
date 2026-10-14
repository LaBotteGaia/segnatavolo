import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRooms, useTables, type Reservation } from "@/lib/data";

export const GRID_COLS = 6;
export const GRID_ROWS = 5;

export function TableDialog({
  open,
  onOpenChange,
  reservation,
  others,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reservation: Reservation;
  others: Reservation[];
  onConfirm: (ids: string[]) => void;
}) {
  const { data: rooms } = useRooms();
  const { data: tables } = useTables();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(reservation.table_ids);

  useEffect(() => {
    if (open) {
      setSelected(reservation.table_ids);
      const first = tables?.find((t) => reservation.table_ids.includes(t.id));
      setRoomId(first?.room_id ?? null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const occupiedBy = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of others) if (o.id !== reservation.id) for (const id of o.table_ids) m.set(id, o.name || "—");
    return m;
  }, [others, reservation.id]);

  const roomTables = tables?.filter((t) => t.room_id === roomId) ?? [];
  const seats = tables?.filter((t) => selected.includes(t.id)).reduce((s, t) => s + t.seats, 0) ?? 0;
  const room = rooms?.find((r) => r.id === roomId);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-paper">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {room ? (
              <button className="inline-flex items-center gap-1" onClick={() => setRoomId(null)}>
                <ChevronLeft className="h-5 w-5" /> {room.name}
              </button>
            ) : (
              "Scegli la sala"
            )}
          </DialogTitle>
          <p className="font-hand text-lg text-muted-foreground">
            {reservation.name || "Prenotazione"} · {reservation.people} persone · {reservation.shift === "pranzo" ? "Pranzo" : "Sera"}
          </p>
        </DialogHeader>

        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm font-semibold",
            seats >= reservation.people ? "border-free text-free" : "border-busy text-busy",
          )}
        >
          Posti selezionati: {seats} / {reservation.people} coperti
        </div>

        {!room ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {rooms?.map((r) => {
              const count = tables?.filter((t) => t.room_id === r.id && selected.includes(t.id)).length ?? 0;
              return (
                <button
                  key={r.id}
                  onClick={() => setRoomId(r.id)}
                  className="rounded-md border bg-card p-4 text-left font-display text-lg hover:bg-accent"
                >
                  {r.name}
                  {count > 0 && <span className="ml-2 text-sm text-primary">({count} selezionati)</span>}
                </button>
              );
            })}
            {!rooms?.length && <p className="text-muted-foreground">Nessuna sala. Creala da "Configura Sale".</p>}
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0,1fr))` }}>
            {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
              const x = i % GRID_COLS;
              const y = Math.floor(i / GRID_COLS);
              const t = roomTables.find((tt) => tt.x === x && tt.y === y);
              if (!t) return <div key={i} className="aspect-square rounded-md border border-dashed border-rule" />;
              const busy = occupiedBy.get(t.id);
              const sel = selected.includes(t.id);
              return (
                <button
                  key={i}
                  disabled={!!busy}
                  onClick={() => toggle(t.id)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-md p-1 text-center text-xs font-bold leading-tight transition",
                    busy ? "bg-busy text-busy-foreground opacity-90" : "bg-free text-free-foreground",
                    sel && "ring-4 ring-primary ring-offset-2 ring-offset-paper",
                  )}
                >
                  <span className="text-sm">{t.name} - {t.seats}p</span>
                  {busy && <span className="truncate font-hand font-normal">{busy}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => setSelected([])}>Libera tavoli</Button>
          <Button
            onClick={() => {
              onConfirm(selected);
              onOpenChange(false);
            }}
          >
            Conferma
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
