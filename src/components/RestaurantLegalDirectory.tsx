import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Input } from '@/components/ui/input';
import { listPublicRestaurants } from '@/lib/restaurant-legal.functions';

/** Ricerca delle informative privacy dei ristoranti attivi sulla piattaforma. */
export function RestaurantLegalDirectory() {
  const [q, setQ] = useState('');
  const { data, isError, isLoading } = useQuery({ queryKey: ['public-restaurants'], queryFn: () => listPublicRestaurants() });
  const list = useMemo(() => (data ?? []).filter(r => r.name.toLowerCase().includes(q.trim().toLowerCase())), [data, q]);
  return <div className="space-y-2">
    <Input aria-label="Cerca ristorante" placeholder="Cerca il ristorante…" value={q} onChange={e => setQ(e.target.value)} />
    {isLoading && <p className="text-muted-foreground">Caricamento…</p>}
    {isError && <p role="alert">Elenco non disponibile al momento.</p>}
    {data && (list.length ? <ul className="divide-y rounded-md border">{list.map(r => <li key={r.slug}><Link to="/prenota/$slug/legal" params={{ slug: r.slug }} className="block px-3 py-2 text-primary underline hover:bg-muted">{r.name}</Link></li>)}</ul> : <p className="text-muted-foreground">Nessun ristorante trovato.</p>)}
  </div>;
}
