import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { manageBooking } from '@/lib/booking-management.functions';
import { ManageBookingPage } from '@/components/ManageBookingPage';

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
  return <ManageBookingPage token={token} initial={initial} />;
}