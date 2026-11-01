import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { manageBooking } from '@/lib/booking-management.functions';
import type { ManagedBooking } from '@/lib/booking-policy';
import { Check, Loader2, Utensils } from 'lucide-react';
export function ManageBookingPage({ token, initial }: { token: string; initial: ManagedBooking }) {
  const [booking, setBooking] = useState(initial); const [busy, setBusy] = useState(false); const [cancel, setCancel] = useState(false); const [edit, setEdit] = useState(false); const [time, setTime] = useState(initial.time); const [people, setPeople] = useState(initial.people); const [error, setError] = useState('');
  const manage = useServerFn(manageBooking);
  const submit = async (action: 'confirm' | 'cancel' | 'request_change') => {
    setBusy(true); setError('');
    try { setBooking(await manage({ data: { token, action, ...(action === 'request_change' ? { time, people } : {}) } })); setCancel(false); setEdit(false); }
    catch { setError('Operazione non completata. Riprova o contatta il ristorante.'); } finally { setBusy(false); }
  };
  const cancelled = booking.confirmation_status.startsWith('cancellata');
  return <main className="min-h-screen bg-background px-4 py-12 text-foreground"><div className="mx-auto max-w-md space-y-6 text-center">
    <Utensils className="mx-auto size-10 text-primary" /><h1 className="font-display text-3xl">{booking.restaurant}</h1>
    <p className="text-xl">{booking.date.split('-').reverse().join('/')} · {booking.shift === 'sera' ? 'Cena' : 'Pranzo'} {booking.time}</p><p>{booking.people} coperti</p>
    {cancelled ? <h2 className="font-display text-2xl">Prenotazione cancellata</h2> : <>
      {booking.confirmation_status === 'riconfermata' ? <p role="status" className="flex items-center justify-center gap-2 font-semibold text-free"><Check />Presenza riconfermata, a presto!</p> : <Button disabled={busy} className="w-full" onClick={() => submit('confirm')}>{busy ? <Loader2 className="animate-spin" /> : <Check />}Riconferma la presenza</Button>}
      {booking.change_request && <p role="status" className="border-y py-3 text-sm">Richiesta di modifica inviata: ore {booking.change_request.time}, {booking.change_request.people} coperti. In attesa del ristorante; la prenotazione originale resta valida.</p>}
      {edit ? <form className="space-y-3 border-t pt-4 text-left" onSubmit={e => { e.preventDefault(); void submit('request_change'); }}><label className="block text-sm">Nuovo orario<Input required type="time" value={time} onChange={e => setTime(e.target.value)} /></label><label className="block text-sm">Coperti<NumberInput min={1} max={100} value={people} onCommit={setPeople} /></label><p className="text-sm text-muted-foreground">La modifica richiede l’approvazione del ristorante. Il tavolo attuale resta riservato.</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setEdit(false)}>Indietro</Button><Button disabled={busy} type="submit">Invia richiesta modifica</Button></div></form> : <Button className="w-full" variant="outline" disabled={busy} onClick={() => { setEdit(true); setCancel(false); }}>Richiedi modifica di orario o coperti</Button>}
      {cancel ? <div className="space-y-3 border-t pt-4"><p>Vuoi cancellare questa prenotazione? Il tavolo sarà liberato.</p><div className="flex justify-center gap-3"><Button variant="outline" disabled={busy} onClick={() => setCancel(false)}>Indietro</Button><Button variant="destructive" disabled={busy} onClick={() => submit('cancel')}>Sì, cancella prenotazione</Button></div></div> : <Button variant="outline" disabled={busy} onClick={() => { setCancel(true); setEdit(false); }}>Cancella prenotazione</Button>}
    </>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div></main>;
}