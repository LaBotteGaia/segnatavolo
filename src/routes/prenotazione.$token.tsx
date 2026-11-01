import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { manageBooking } from '@/lib/booking-management.functions';
import { Check, Loader2, Utensils } from 'lucide-react';

const options = (token: string) => queryOptions({ queryKey: ['manage-booking', token], queryFn: () => manageBooking({ data: { token, action: 'view' } }), retry: false });
export const Route = createFileRoute('/prenotazione/$token')({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(options(params.token)),
  head: () => ({ meta: [{ title: 'Riconferma prenotazione | Segnatavolo' }, { name: 'description', content: 'Riconferma o cancella la tua prenotazione al ristorante.' }, { property: 'og:title', content: 'Riconferma prenotazione | Segnatavolo' }, { property: 'og:description', content: 'Gestisci la presenza al ristorante in sicurezza.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }] }),
  errorComponent: () => <main className="min-h-screen bg-background p-8 text-center text-foreground"><h1 className="font-display text-2xl">Link non disponibile</h1><p className="mt-4">La prenotazione non è più gestibile da questo link. Contatta il ristorante.</p></main>,
  component: ManagePage,
});

function ManagePage() {
  const { token } = Route.useParams();
  const { data: initial } = useSuspenseQuery(options(token));
  const [booking, setBooking] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [error, setError] = useState('');
  const manage = useServerFn(manageBooking);
  const submit = async (action: 'confirm' | 'cancel') => {
    setBusy(true); setError('');
    try { setBooking(await manage({ data: { token, action } })); setCancel(false); }
    catch { setError('Operazione non completata. Riprova o contatta il ristorante.'); }
    finally { setBusy(false); }
  };
  const cancelled = booking.confirmation_status.startsWith('cancellata');
  return <main className="min-h-screen bg-background px-4 py-12 text-foreground"><div className="mx-auto max-w-md space-y-6 text-center">
    <Utensils className="mx-auto size-10 text-primary"/><h1 className="font-display text-3xl">{booking.restaurant}</h1>
    <p className="text-xl">{booking.date.split('-').reverse().join('/')} · {booking.shift === 'sera' ? 'Cena' : 'Pranzo'} {booking.time}</p><p>{booking.people} coperti</p>
    {cancelled ? <h2 className="font-display text-2xl">Prenotazione cancellata</h2> : <>
      {booking.confirmation_status === 'riconfermata' ? <p role="status" className="flex items-center justify-center gap-2 font-semibold text-free"><Check/>Presenza riconfermata, a presto!</p> : <Button disabled={busy} className="w-full" onClick={() => submit('confirm')}>{busy ? <Loader2 className="animate-spin"/> : <Check/>}Riconferma la presenza</Button>}
      {cancel ? <div className="space-y-3 border-t pt-4"><p>Vuoi cancellare questa prenotazione? Il tavolo sarà liberato.</p><div className="flex justify-center gap-3"><Button variant="outline" disabled={busy} onClick={() => setCancel(false)}>Indietro</Button><Button variant="destructive" disabled={busy} onClick={() => submit('cancel')}>Sì, cancella prenotazione</Button></div></div> : <Button variant="outline" disabled={busy} onClick={() => setCancel(true)}>Cancella prenotazione</Button>}
    </>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div></main>;
}