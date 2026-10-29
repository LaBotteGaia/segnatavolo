import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMembership, useSettings } from '@/lib/membership';
import { useActiveRestaurantId } from '@/lib/tenant';
import { reservationsQuery, roomsQuery, tablesQuery, shiftName, wallsOf, useRooms, useTables, useActiveCustomRules, type Reservation, type Shift } from '@/lib/data';
import { isRoomClosedFor } from '@/lib/rotation';
import { weatherReorganization } from '@/lib/weather-reorganization';
import { fetchWeather, serviceWeather, weatherSettingsOf } from '@/services/weatherService';

export function WeatherBadge({date,shift,rows}:{date:string;shift:Shift;rows:Reservation[]}) {
  const rid = useActiveRestaurantId();
  const {data:me} = useMembership();
  const settings = useSettings();
  const location = useQuery({queryKey:['weather-location',rid],enabled:!!rid,staleTime:30*60*1000,queryFn:async()=>{
    const {data,error} = await supabase.from('restaurants').select('public_address,name').eq('id',rid ?? '').single();
    if(error) throw error;
    return data;
  }});
  const savedWeather = weatherSettingsOf(me?.restaurants?.settings);
  const addressCity = location.data?.public_address?.match(/\b\d{5}\s+(.+?)(?:\s+[A-Z]{2})?$/)?.[1] ?? '';
  const weather = {...savedWeather,city:savedWeather.city || addressCity || location.data?.name.split(' - ')[1] || ''};
  const {data:rooms=[]} = useRooms();
  const {data:tables=[]} = useTables();
  const customRules = useActiveCustomRules();
  const qc = useQueryClient();
  const [open,setOpen] = useState(false);
  const [detailOpen,setDetailOpen] = useState(false);
  const [report,setReport] = useState<{moved:number;unplaced:Reservation[]} | null>(null);
  const forecast = useQuery({queryKey:['weather',rid,date,weather.latitude,weather.longitude,weather.city],enabled:!!rid && !location.isPending,staleTime:30*60*1000,gcTime:60*60*1000,refetchInterval:30*60*1000,retry:1,queryFn:({signal})=>fetchWeather(weather,date,signal)});
  const summary = forecast.data ? serviceWeather(forecast.data,date,shift,weather) : null;
  const outdoor = new Set(rooms.filter(r=>r.is_outdoor).map(r=>r.id));
  const outsideTables = new Set(tables.filter(t=>outdoor.has(t.room_id)).map(t=>t.id));
  const affected = rows.filter(r=>!r.no_show && r.table_ids.some(id=>outsideTables.has(id)));
  const exposed = rooms.some(r=>r.is_outdoor && !isRoomClosedFor(r,date,shift)) || affected.length>0;
  const locked = affected.some(r=>r.tavolo_bloccato);
  const apply = useMutation({mutationFn:async()=>{
    if(!rid) throw new Error('Ristorante non disponibile');
    const [all,freshRooms,freshTables] = await Promise.all([qc.fetchQuery({...reservationsQuery(date,rid),staleTime:0}),qc.fetchQuery({...roomsQuery(rid),staleTime:0}),qc.fetchQuery({...tablesQuery(rid),staleTime:0})]);
    const current = all.filter(r=>r.shift===shift);
    const {result,plan} = weatherReorganization({date,shift,reservations:current,tables:freshTables,rooms:freshRooms,rules:settings.assignmentRules,customRules,cfg:{duration:settings.duration,buffer:settings.buffer},wallsFor:id=>wallsOf(freshRooms.find(r=>r.id===id))});
    const expected = [...current].sort((a,b)=>a.id.localeCompare(b.id));
    const {error} = await supabase.rpc('close_weather_service',{_rid:rid,_date:date,_shift:shift,_expected:expected,_plan:plan});
    if(error) throw new Error(error.message);
    return {moved:result.moves.length,unplaced:current.filter(r=>result.unplaced.some(u=>u.id===r.id))};
  },onSuccess:async result=>{setReport(result); await Promise.all(['rooms','reservations','reservations-month','online-requests','customer-history'].map(key=>qc.invalidateQueries({queryKey:[key]})));toast.success('Dehors chiusi per questo turno');},onError:e=>toast.error(e.message)});
  return <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 text-xs" data-no-swipe>
    <Popover open={detailOpen} onOpenChange={setDetailOpen}><PopoverTrigger asChild><Button size="sm" variant="outline" className={summary?.critical?'border-warning text-warning':'text-foreground'} onMouseEnter={()=>setDetailOpen(true)} aria-label={`Meteo ${shiftName(shift)}`}>
      {summary?`${summary.icon} ${Math.round(summary.temperature)}°C`:forecast.isFetching?'Meteo…':'Meteo —'}
    </Button></PopoverTrigger><PopoverContent className="w-72 max-w-[90vw] text-sm" onMouseLeave={()=>setDetailOpen(false)}>
      <p className="font-semibold">{shiftName(shift)} · {date.split('-').reverse().join('/')}</p>
      {forecast.isError?<p className="mt-2 text-muted-foreground">{forecast.error.message}</p>:!summary?<p className="mt-2">Previsioni non disponibili</p>:<>
        <p className={summary.critical?'my-2 font-semibold text-warning':'my-2 text-free'}>{summary.critical?summary.reasons.join(' · '):'Favorevole'}</p>
        <ul className="space-y-1">{summary.hours.map(h=><li key={h.time}>{h.time.slice(11,16)} · {Math.round(h.temperature)}°C · Pioggia {h.probability}% · {h.wind} km/h</li>)}</ul>
      </>}<p className="mt-2 text-xs text-muted-foreground">Open-Meteo · Europe/Rome</p>
    </PopoverContent></Popover>
    {summary?.critical && exposed && <Button variant="outline" size="sm" className="h-auto min-w-0 whitespace-normal border-warning bg-warning/10 py-2 text-left text-warning motion-safe:animate-pulse" onClick={()=>{setReport(null);setOpen(true);}}>⚠️ Allerta Meteo: {summary.reasons.join(' · ')} — Chiudi Dehors e Riorganizza Tavoli</Button>}
    <Dialog open={open} onOpenChange={o=>!apply.isPending && setOpen(o)}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>⚠️ Riorganizzazione per Maltempo</DialogTitle></DialogHeader>
      <p className="text-sm">{date.split('-').reverse().join('/')} — {shiftName(shift)} · {summary?.reasons.join(' · ')} ({summary && Math.round(summary.temperature)}°C)</p>
      {report?<div className="space-y-3 text-sm"><p className="font-semibold text-free">Dehors chiusi · {report.moved} comitive riposizionate all’interno</p>{report.unplaced.length>0 && <div className="border-l-4 border-destructive pl-3 text-destructive"><p className="font-semibold">Senza posto interno: contatto urgente ({report.unplaced.length})</p><ul>{report.unplaced.map(r=><li key={r.id}>{r.name} · {r.people} coperti · {r.time} {r.phone?<a className="underline" href={`tel:${r.phone}`}>{r.phone}</a>:'Telefono non disponibile'}</li>)}</ul></div>}<Button onClick={()=>setOpen(false)}>Chiudi report</Button></div>:<>
        <p className="text-sm">Attualmente {affected.length} prenotazioni ({affected.reduce((n,r)=>n+r.people,0)} coperti) sono assegnate alle zone esterne. Vuoi chiudere le sale all’aperto e riallocare gli ospiti nei tavoli interni aperti?</p>
        <p className="text-sm text-muted-foreground">La chiusura vale solo per questa data e turno. Le comitive senza posto resteranno in agenda senza tavolo, da contattare; nessuna prenotazione sarà cancellata.</p>
        {locked && <p className="text-sm font-semibold text-destructive">Sblocca prima le prenotazioni esterne protette dal lucchetto.</p>}
        {me?.role!=='master' && <p className="text-sm text-muted-foreground">Chiusura e riorganizzazione riservate al Master.</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={apply.isPending} onClick={()=>setOpen(false)}>Annulla</Button><Button disabled={apply.isPending || locked || me?.role!=='master'} onClick={()=>apply.mutate()}>{apply.isPending?'Riorganizzazione…':'✅ Chiudi Dehors e Riorganizza'}</Button></div>
      </>}
    </DialogContent></Dialog>
  </div>;
}