import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { Check, Maximize, Minus, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { gridOf, wallsOf, type Room, type RTable } from '@/lib/data';
import type { TableState } from '@/lib/rotation';

const CELL = 124;
export function FloorPlan({ room, tables, selected, suggested, people, stateOf, closed, extended, onToggle, pillOf }: {
  room: Room; tables: RTable[]; selected: string[]; suggested: string[]; people: number;
  stateOf: (id: string) => TableState; closed: boolean; extended: boolean; onToggle: (id: string) => void; pillOf?: (id: string) => string | null;
}) {
  const grid = gridOf(room);
  const cols = Math.max(grid.cols, ...tables.map(t => t.x + 1));
  const rows = Math.max(grid.rows, ...tables.map(t => t.y + 1));
  const width = cols * CELL, height = rows * CELL;
  const joined = tables.filter(t => selected.includes(t.id));
  const walls = wallsOf(room);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return <TransformWrapper key={room.id} initialScale={0.65} minScale={0.2} maxScale={2.5} centerOnInit
    wheel={{ step: 0.04 }} panning={{ excluded: ['button'], velocityDisabled: true }} doubleClick={{ disabled: true }}>
    {({ zoomIn, zoomOut, resetTransform }) => <div className="space-y-2">
      <div className="flex items-center justify-end gap-1">
        <Button type="button" variant="outline" size="icon" aria-label="Riduci mappa" title="Riduci mappa" onClick={() => zoomOut(0.2, reduced ? 0 : 150)}><Minus/></Button>
        <Button type="button" variant="outline" size="icon" aria-label="Ingrandisci mappa" title="Ingrandisci mappa" onClick={() => zoomIn(0.2, reduced ? 0 : 150)}><Plus/></Button>
        <Button type="button" variant="outline" size="icon" aria-label="Centra mappa" title="Centra mappa" onClick={() => resetTransform(reduced ? 0 : 150)}><Maximize/></Button>
      </div>
      <div data-no-swipe className="floor-plan-viewport relative h-[min(48vh,440px)] min-h-60 w-full overflow-hidden rounded-md border border-rule bg-background" aria-label={`Mappa di ${room.name}`}>
        <TransformComponent wrapperClass="floor-plan-transform" contentClass="floor-plan-content">
          <div className="floor-plan-surface relative select-none" style={{ width: width + 24, height: height + 24 }}>
            <svg aria-label="Pareti e raccordi" className="pointer-events-none absolute inset-3 text-foreground" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              {walls.map(key => {
                const [kind, sx, sy] = key.split(':');
                const x = Number(sx) * CELL, y = Number(sy) * CELL;
                if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                if (kind === 'o') return <g key={key} className="text-muted-foreground" stroke="currentColor" strokeWidth="4"><path d={`M${x+30},${y+30} l64,64 M${x+94},${y+30} l-64,64`}/></g>;
                if (kind !== 'h' && kind !== 'v') return null;
                return <line key={key} x1={x} y1={y} x2={kind === 'h' ? x + CELL : x} y2={kind === 'v' ? y + CELL : y} stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>;
              })}
              {joined.flatMap((a, i) => joined.slice(i+1).filter(b => Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)) <= 1).map(b => <line key={`${a.id}:${b.id}`} aria-label={`Raccordo ${a.name} e ${b.name}`} x1={(a.x+0.5)*CELL} y1={(a.y+0.5)*CELL} x2={(b.x+0.5)*CELL} y2={(b.y+0.5)*CELL} className="text-primary" stroke="currentColor" strokeWidth="8" strokeDasharray="9 5"/>))}
            </svg>
            {tables.map(t => {
              const state = stateOf(t.id), busy = state.kind === 'busy', sel = selected.includes(t.id);
              const comfort = t.coperti_comodi ?? t.seats, max = t.coperti_max ?? comfort;
              const tight = people > comfort || (sel && extended);
              const recommended = suggested.includes(t.id) && !busy && !closed;
              return <div key={t.id} className="absolute" style={{ left: t.x*CELL+24, top: t.y*CELL+24, width: CELL-24, height: CELL-24 }}>
                <Button variant="outline" type="button" aria-label={`Tavolo ${t.name}`} aria-pressed={sel} disabled={busy || (closed && !sel)}
                  title={busy ? `Occupato · ${state.name} · fino alle ${state.until}` : `${comfort} coperti comodi, massimo ${max}${!t.accoppiabile ? ' · Isola' : ''}${t.adatto_seduta_lunga ? ' · Seduta lunga' : ''}`}
                  onClick={() => onToggle(t.id)} className={cn('h-full w-full flex-col gap-1 whitespace-normal border-2 p-2 text-center leading-tight',
                    busy ? 'border-muted-foreground bg-muted text-muted-foreground disabled:opacity-40' : closed ? 'bg-muted text-muted-foreground' : tight ? 'border-warning bg-warning/15 text-foreground' : 'border-free/50 bg-free/15 text-foreground',
                    recommended && 'floor-plan-recommended ring-2 ring-recommendation', sel && 'border-primary ring-2 ring-primary bg-primary/10')}>
                  <span className="flex max-w-full items-center gap-1 break-all text-lg font-bold">T.{t.name}{sel && <Check className="size-3"/>}</span>
                  <span className="text-xs">{comfort} comodi · max {max}</span>
                  {busy ? <span className="line-clamp-2 text-[10px]">Occupato · {state.name} · fino {state.until}</span> : tight ? <span className="flex items-center gap-1 text-[10px]"><TriangleAlert className="size-3"/>{sel && extended ? 'Prolunga' : people <= max ? `⚠️ Posti Scomodi (Max ${max}p)` : 'Unione / prolunga'}</span> : state.kind === 'limited' ? <span className="text-[10px]">Libero fino {state.until}</span> : !t.accoppiabile ? <span className="text-[10px]">Isola</span> : null}
                </Button>
                {!busy && pillOf?.(t.id) && <span className="pointer-events-none absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-free bg-card px-2 py-0.5 text-[10px] font-bold text-foreground">{pillOf(t.id)}</span>}
                {recommended && <span className="pointer-events-none absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-recommendation bg-card px-2 py-0.5 text-[10px] font-bold text-foreground"><Sparkles className="size-3 text-recommendation"/>Consigliato</span>}
              </div>;
            })}
          </div>
        </TransformComponent>
      </div>
      {!tables.length && <p className="text-sm text-muted-foreground">Nessun tavolo in questa sala.</p>}
    </div>}
  </TransformWrapper>;
}