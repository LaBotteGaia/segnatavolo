import { useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import type { RTable } from "@/lib/data";

export const GRID_COLS = 6;
export const GRID_ROWS = 5;

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

/** Griglia della sala con tavoli e pareti. In modalità editWalls mostra le zone cliccabili sui bordi. */
export function RoomGrid({
  tables, walls, renderCell, editWalls, onToggleWall, cols = GRID_COLS, rows = GRID_ROWS,
}: {
  cols?: number;
  rows?: number;
  tables: RTable[];
  walls: string[];
  renderCell: (x: number, y: number, t: RTable | undefined) => ReactNode;
  editWalls?: boolean;
  onToggleWall?: (key: string) => void;
}) {
  const [cell, setCell] = useState(46);
  const box = useRef<HTMLDivElement>(null);
  const setZoom = (n: number) => setCell(Math.min(110, Math.max(24, Math.round(n))));
  const cellRef = useRef(cell);
  cellRef.current = cell;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // pinch del trackpad o Ctrl+rotella
      e.preventDefault();
      setZoom(cellRef.current * Math.exp(-e.deltaY * 0.01));
    };
    let pinch: number | null = null, start = 0;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const ts = (e: TouchEvent) => { if (e.touches.length === 2) { pinch = dist(e.touches); start = cellRef.current; } };
    const tm = (e: TouchEvent) => { if (pinch && e.touches.length === 2) { e.preventDefault(); setZoom(start * (dist(e.touches) / pinch)); } };
    const te = () => { pinch = null; };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: false });
    el.addEventListener("touchend", te);
    return () => { el.removeEventListener("wheel", onWheel); el.removeEventListener("touchstart", ts); el.removeEventListener("touchmove", tm); el.removeEventListener("touchend", te); };
  }, []);
  const edges: { key: string; style: React.CSSProperties }[] = [];
  for (let y = 0; y <= rows; y++)
    for (let x = 0; x < cols; x++)
      edges.push({ key: `h:${x}:${y}`, style: { left: pct(x, cols), top: pct(y, rows), width: pct(1, cols) } });
  for (let x = 0; x <= cols; x++)
    for (let y = 0; y < rows; y++)
      edges.push({ key: `v:${x}:${y}`, style: { left: pct(x, cols), top: pct(y, rows), height: pct(1, rows) } });

  return (
    <div>
    <div className="mb-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
      Zoom
      <button type="button" aria-label="Riduci" className="rounded border bg-card p-1" onClick={() => setZoom(cell / 1.2)}><Minus className="size-3.5" /></button>
      <button type="button" aria-label="Ingrandisci" className="rounded border bg-card p-1" onClick={() => setZoom(cell * 1.2)}><Plus className="size-3.5" /></button>
    </div>
    <div ref={box} data-no-swipe className="max-h-[65vh] overflow-auto rounded-md border border-rule/60 p-2">
    <div className="relative select-none" style={{ width: cols * cell, height: rows * cell, fontSize: Math.max(9, cell / 4) }}>
      {Array.from({ length: rows * cols }).map((_, i) => {
        const x = i % cols, y = Math.floor(i / cols);
        const t = tables.find((tt) => tt.x === x && tt.y === y);
        return (
          <div key={i} className="absolute p-0.5" style={{ left: pct(x, cols), top: pct(y, rows), width: pct(1, cols), height: pct(1, rows) }}>
            {renderCell(x, y, t)}
            {walls.includes(`o:${x}:${y}`) && (
              <svg aria-label="Ostacolo" viewBox="0 0 10 10" className="pointer-events-none absolute inset-1 text-foreground opacity-35">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )}
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
    </div>
    </div>
  );
}
