import { Check, Clock3, LockKeyhole, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Room, RTable } from '@/lib/data';
import type { TableState } from '@/lib/rotation';

export function TableCards({ tables, room, selected, suggested, people, stateOf, closed, onToggle }: {
  tables: RTable[]; room: Room; selected: string[]; suggested: string[]; people: number;
  stateOf: (id:string)=>TableState; closed: boolean; onToggle:(id:string)=>void;
}) {
  return <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
    {tables.map(t=>{
      const state=stateOf(t.id), busy=state.kind==='busy', sel=selected.includes(t.id), recommended=suggested.includes(t.id);
      const comodi=t.coperti_comodi ?? t.seats, max=t.coperti_max ?? comodi;
      const tight=people>comodi && (people<=max || t.allow_extras);
      return <Button key={t.id} type="button" variant="outline" aria-label={`Tavolo ${t.name}`} aria-pressed={sel} disabled={busy || closed}
        onClick={()=>onToggle(t.id)} className={cn('relative h-auto min-h-44 w-full flex-col items-start justify-start gap-3 whitespace-normal rounded-2xl border-2 bg-card p-4 text-left transition duration-200 motion-safe:hover:-translate-y-0.5',
          busy||closed?'border-border opacity-50':tight?'border-warning/70':'border-free/40', recommended&&!busy&&!closed&&'ring-2 ring-primary shadow-lg',sel&&'bg-primary/5 border-primary')}>
        <div className="flex w-full items-center justify-between gap-2"><span className="break-words text-xl font-bold">Tavolo {t.name}</span>{sel&&<Check className="text-primary"/>}</div>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold',room.environment==='esterno'?'bg-free/10 text-foreground':'bg-primary/10 text-primary')}>{room.name}</span>
        <span className="flex items-center gap-2 text-sm"><Users className="size-4"/>{comodi} comodi <span className="text-muted-foreground">(max {max})</span></span>
        <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">{!t.accoppiabile&&<span className="flex items-center gap-1" title="Non accoppiabile"><LockKeyhole className="size-3"/>Isola</span>}{t.adatto_seduta_lunga&&<span className="flex items-center gap-1"><Clock3 className="size-3"/>Seduta Lunga</span>}</span>
        <span className="mt-auto text-xs font-semibold">{busy?`Occupato fino alle ${state.until} · ${state.name}`:closed?'Sala chiusa':recommended?<span className="flex items-center gap-1 text-primary motion-safe:animate-pulse"><Sparkles className="size-3"/>Consigliato per {people} pax</span>:tight?people<=max?`Usa ${people-comodi} ${people-comodi===1?'posto sacrificato':'posti sacrificati'}`:'Unione / prolunga necessaria':state.kind==='limited'?`Disponibile fino alle ${state.until}`:'Disponibile comodo'}</span>
      </Button>;
    })}
    {!tables.length&&<p className="text-sm text-muted-foreground">Nessun tavolo in questa sala.</p>}
  </div>;
}