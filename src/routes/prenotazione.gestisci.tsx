import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { manageBooking } from '@/lib/booking-management.functions';
import { ManageBookingPage } from '@/components/ManageBookingPage';
const options = (token: string) => queryOptions({ queryKey: ['manage-booking', token], queryFn: () => manageBooking({ data: { token, action: 'view' } }), retry: false });
export const Route = createFileRoute('/prenotazione/gestisci')({
  validateSearch: (s: Record<string, unknown>) => ({ token: z.string().uuid().catch('').parse(s['token']) }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: ({ deps, context }) => context.queryClient.ensureQueryData(options(deps.token)),
  head: () => ({ meta: [{ title: 'Modifica o annulla prenotazione — Segnatavolo' }, { name: 'description', content: 'Richiedi una modifica o cancella la tua prenotazione con il link riservato.' }, { property: 'og:title', content: 'Gestisci prenotazione — Segnatavolo' }, { property: 'og:description', content: 'Gestione sicura della prenotazione al ristorante.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }] }),
  errorComponent: () => <main className="min-h-screen bg-background p-8 text-center text-foreground"><h1 className="font-display text-2xl">Link non disponibile</h1><p className="mt-4">Contatta il ristorante per gestire la prenotazione.</p></main>,
  component: () => { const { token } = Route.useSearch(); const { data } = useSuspenseQuery(options(token)); return <ManageBookingPage token={token} initial={data} />; },
});