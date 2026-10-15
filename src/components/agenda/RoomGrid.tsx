import type { ReactNode } from "react";
import type { RTable } from "@/lib/data";

export const GRID_COLS = 6;
export const GRID_ROWS = 5;

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

/** Griglia della sala con tavoli e pareti. In modalità editWalls mostra le zone cliccabili sui bordi. */
export function RoomGrid({
  tables, walls, renderCell, editWalls, onToggleWall,
}: {
  tables: RTable[];
  walls: string[];
  renderCell: (x: number, y: number, t: RTable | undefined) => ReactNode;
  editWalls?: boolean;
  onToggleWall?: (key: string) => void;
}) {
  const edges: { key: string; style: React.CSSProperties }[] = [];
  for (let y = 0; y <= GRID_ROWS; y++)
    for (let x = 0; x < GRID_COLS; x++)
      edges.push({ key: `h:${x}:${y}`, style: { left: pct(x, GRID_COLS), top: pct(y, GRID_ROWS), width: pct(1, GRID_COLS) } });
  for (let x = 0; x <= GRID_COLS; x++)
    for (let y = 0; y < GRID_ROWS; y++)
      edges.push({ key: `v:${x}:${y}`, style: { left: pct(x, GRID_COLS), top: pct(y, GRID_ROWS), height: pct(1, GRID_ROWS) } });

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: `${GRID_COLS} / ${GRID_ROWS}` }}>
      {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
        const x = i % GRID_COLS, y = Math.floor(i / GRID_COLS);
        const t = tables.find((tt) => tt.x === x && tt.y === y);
        return (
          <div key={i} className="absolute p-1" style={{ left: pct(x, GRID_COLS), top: pct(y, GRID_ROWS), width: pct(1, GRID_COLS), height: pct(1, GRID_ROWS) }}>
            {renderCell(x, y, t)}
          </div>
        );
      })}
      {edges.map(({ key, style }) => {
        const on = walls.includes(key);
        const h = key.startsWith("h");
        if (!on && !editWalls) return null;
        return (
          <div key={key} className="pointer-events-none absolute z-10" style={style}>
            {editWalls && (
              <button
                type="button"
                aria-label={on ? "Rimuovi parete" : "Aggiungi parete"}
                onClick={() => onToggleWall?.(key)}
                className={`group pointer-events-auto absolute flex items-center justify-center ${h ? "inset-x-1 -top-2.5 h-5" : "inset-y-1 -left-2.5 w-5"}`}
              >
                {!on && <span className={`rounded-full bg-primary/0 transition group-hover:bg-primary/50 ${h ? "h-1.5 w-full" : "h-full w-1.5"}`} />}
              </button>
            )}
            {on && (
              <span
                className={`pointer-events-none absolute rounded-full bg-foreground shadow-sm ${h ? "-top-[3px] -left-[3px] -right-[3px] h-1.5" : "-left-[3px] -top-[3px] -bottom-[3px] w-1.5"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
