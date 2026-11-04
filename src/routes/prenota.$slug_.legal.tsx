import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, Utensils } from 'lucide-react';
import { slugSchema } from '@/lib/online-booking';
import { getRestaurantLegal } from '@/lib/restaurant-legal.functions';
import { RestaurantLegalContent } from '@/components/RestaurantLegalContent';
import { controllerName } from '@/lib/restaurant-legal';
import { BackToAgendaLink } from '@/components/BackToAgendaLink';

const options = (slug: string) => queryOptions({ queryKey: ['restaurant-legal', slug], queryFn: async () => { if (!slugSchema.safeParse(slug).success) throw notFound(); const r = await getRestaurantLegal({ data: { slug } }); if (!r) throw notFound(); return r; } });

export const Route = createFileRoute('/prenota/$slug_/legal')({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(options(params.slug)),
  head: ({ loaderData }) => {
    const title = loaderData ? `Privacy e Condizioni di Prenotazione — ${loaderData.name}` : 'Informativa Privacy | Segnatavolo';
    const description = loaderData ? `Informativa GDPR e condizioni di prenotazione di ${controllerName(loaderData)}: titolare, dati, finalità e diritti.` : 'Informativa privacy del ristorante.';
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'article' }, { name: 'twitter:card', content: 'summary' }] };
  },
  errorComponent: () => <Notice title="Informativa non raggiungibile" />,
  notFoundComponent: () => <Notice title="Informativa non disponibile" />,
  component: LegalPage,
});

function Notice({ title }: { title: string }) {
  return <main className="min-h-dvh bg-background p-8 text-center"><Utensils className="mx-auto mb-6 size-10 text-primary" /><h1 className="font-display text-2xl">{title}</h1><p className="mt-4 text-muted-foreground">Il link non è corretto oppure il ristorante non è attivo.</p></main>;
}

function LegalPage() {
  const { slug } = Route.useParams();
  const { data: r } = useSuspenseQuery(options(slug));
  return <main className="min-h-dvh bg-background text-foreground">
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">{r.logo ? <img src={r.logo} alt={`Logo ${r.name}`} className="size-9 rounded object-contain" /> : <Utensils className="size-6 text-primary" />}<span className="truncate font-display text-lg">{r.name}</span></div>
      <div className="flex flex-wrap justify-end gap-2"><BackToAgendaLink /><Link to="/prenota/$slug" params={{ slug }} className="inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><ArrowLeft className="size-4" />Torna al modulo di prenotazione</Link></div>
    </header>
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 font-display text-3xl">Informativa Privacy e Condizioni di Prenotazione</h1>
      <p className="mb-6 text-sm text-muted-foreground">Ai sensi degli artt. 13-14 del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003.</p>
      <RestaurantLegalContent r={r} />
      <p className="mt-8 border-t pt-3 text-xs text-muted-foreground">Servizio di prenotazione fornito da Segnatavolo · <Link to="/termini" className="underline">Termini della piattaforma</Link></p>
    </div>
  </main>;
}
