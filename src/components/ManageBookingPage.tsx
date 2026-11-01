import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PublicScheduleCalendar } from '@/components/PublicScheduleCalendar';
import { getOnlinePage } from '@/lib/online-booking.functions';
import { getManagedSlots } from '@/lib/customer-change.functions';
import { slotGroups } from '@/lib/online-booking';
import { closureMessage } from '@/lib/schedule-exceptions';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { manageBooking } from '@/lib/booking-management.functions';
import type { ManagedBooking } from '@/lib/booking-policy';
import { Check, Loader2, Utensils } from 'lucide-react';
export function ManageBookingPage({ token, initial }: { token: string; initial: ManagedBooking }) {
  const [booking, setBooking] = useState(initial); const [busy, setBusy] = useState(false); const [cancel, setCancel] = useState(false); const [edit, setEdit] = useState(false); const [time, setTime] = useState(initial.time); const [people, setPeople] = useState(initial.people); const [error, setError] = useState('');
  const manage = useServerFn(manageBooking);
  const [date,setDate]=useState(initial.date); const [shift,setShift]=useState<'pranzo'|'sera'>(initial.shift==='sera'?'sera':'pranzo');
  const page=useQuery({queryKey:['manage-public-page',booking.slug],enabled:!!booking.slug&&edit,queryFn:()=>getOnlinePage({data:{slug:booking.slug??''}})});
  const slots=useQuery({queryKey:['managed-slots',token,date,shift],enabled:edit&&!!date,queryFn:()=>getManagedSlots({data:{token,date,shift}}),refetchInterval:15000});
  const max=page.data?.config.max_party_size??6; const selected=slots.data?.find(s=>s.time===time); const available=!!selected&&selected.remaining!==null&&selected.remaining>=people&&people<=max;
  const submit = async (action: 'confirm' | 'cancel' | 'request_change') => {
    setBusy(true); setError('');
    try { setBooking(await manage({ data: { token, action, ...(action === 'request_change' ? { date,shift,time, people } : {}) } })); setCancel(false); setEdit(false); }
    catch { setError('Operazione non completata. Riprova o contatta il ristorante.'); } finally { setBusy(false); }
  };
  const cancelled = booking.confirmation_status.startsWith('cancellata');
  return <main className="min-h-screen bg-background px-4 py-12 text-foreground"><div className="mx-auto max-w-md space-y-6 text-center">
    <Utensils className="mx-auto size-10 text-primary" /><h1 className="font-display text-3xl">{booking.restaurant}</h1>
    <p className="text-xl">{booking.date.split('-').reverse().join('/')} · {booking.shift === 'sera' ? 'Cena' : 'Pranzo'} {booking.time}</p><p>{booking.people} coperti</p>
    {cancelled ? <h2 className="font-display text-2xl">Prenotazione cancellata</h2> : <>
      {booking.confirmation_status === 'riconfermata' ? <p role="status" className="flex items-center justify-center gap-2 font-semibold text-free"><Check />Presenza riconfermata, a presto!</p> : <Button disabled={busy} className="w-full" onClick={() => submit('confirm')}>{busy ? <Loader2 className="animate-spin" /> : <Check />}Riconferma la presenza</Button>}
      {booking.change_request && <div role="status" className="space-y-2 border-y py-3 text-sm"><p>La tua richiesta di modifica è stata inviata al ristorante ed è in attesa di approvazione. La prenotazione originaria rimane valida fino a conferma della nuova richiesta.</p><p>{(booking.change_request.date??booking.date).split('-').reverse().join('/')} · {booking.change_request.time} · {booking.change_request.people} coperti</p></div>}
      {booking.modification_status==='rejected'&&<p role="status" className="border-y py-3 text-sm">Modifica non accolta: {booking.modification_reason}. La prenotazione originaria resta confermata.</p>}
      {booking.modification_status==='accepted'&&<p role="status" className="text-free">Modifica approvata: qui sopra trovi il riepilogo aggiornato.</p>}
      {edit ? <form className="space-y-3 border-t pt-4 text-left" onSubmit={e => { e.preventDefault(); if(available)void submit('request_change'); }}>
        <h2 className="font-semibold">Nuova data</h2>{page.isPending?<Loader2 className="animate-spin"/>:page.data?<PublicScheduleCalendar page={page.data} date={date} onSelect={d=>{setDate(d);setTime('');}}/>:<p role="alert">Modifiche online non disponibili. Contatta il ristorante.</p>}
        <div className="grid grid-cols-2 gap-2">{(['pranzo','sera'] as const).map(s=><Button key={s} type="button" variant={s===shift?'default':'outline'} aria-pressed={s===shift} onClick={()=>{setShift(s);setTime('');}}>{s==='pranzo'?'Pranzo':'Cena'}</Button>)}</div>
        {page.data&&closureMessage(page.data.schedule_exceptions,date,shift)&&<p role="status" className="text-sm text-muted-foreground">{closureMessage(page.data.schedule_exceptions,date,shift)}</p>}
        <h2 className="font-semibold">Nuovo orario</h2>{slots.isPending?<Loader2 className="animate-spin"/>:slots.isError?<p role="alert">Orari non disponibili.</p>:<div className="space-y-3">{slotGroups(slots.data??[]).map(g=><fieldset key={g.label}>{g.label&&<legend className="mb-2 text-sm font-semibold">{g.label}</legend>}<div className="grid grid-cols-3 gap-2">{g.slots.map(s=><Button key={s.time} type="button" disabled={!s.remaining||s.remaining<people} variant={time===s.time?'default':'outline'} onClick={()=>setTime(s.time)}>{s.time}</Button>)}</div></fieldset>)}{!slots.data?.some(s=>s.remaining)&&<p role="status">Nessun orario disponibile per questo servizio.</p>}</div>}
        <label className="block text-sm">Coperti<NumberInput min={1} max={max} value={people} onCommit={setPeople}/></label><p className="text-sm text-muted-foreground">La modifica richiede l’approvazione del ristorante. Il tavolo attuale resta riservato.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setEdit(false)}>Indietro</Button><Button disabled={busy||!available||!page.data} type="submit">Invia richiesta modifica</Button></div>
      </form> : <Button className="h-auto w-full whitespace-normal" variant="outline" disabled={busy||!!booking.change_request||!booking.slug} onClick={()=>{setDate(booking.date);setTime(booking.time);setPeople(booking.people);setShift(booking.shift==='sera'?'sera':'pranzo');setEdit(true);setCancel(false);}}>Richiedi modifica di data, orario o coperti</Button>}
      {cancel ? <div className="space-y-3 border-t pt-4"><p>Vuoi cancellare questa prenotazione? Il tavolo sarà liberato.</p><div className="flex justify-center gap-3"><Button variant="outline" disabled={busy} onClick={() => setCancel(false)}>Indietro</Button><Button variant="destructive" disabled={busy} onClick={() => submit('cancel')}>Sì, cancella prenotazione</Button></div></div> : <Button variant="outline" disabled={busy} onClick={() => { setCancel(true); setEdit(false); }}>Cancella prenotazione</Button>}
    </>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div></main>;
}