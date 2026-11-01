import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useActiveRestaurantId } from '@/lib/tenant';
import { toast } from 'sonner';
export function ServiceNotifications() {
  const rid = useActiveRestaurantId(); const qc = useQueryClient();
  const query = useQuery({ queryKey: ['service-notifications', rid], enabled: !!rid, refetchInterval: 60000, queryFn: async () => {
    const { data, error } = await supabase.from('service_notifications').select('*').eq('restaurant_id', rid ?? '').order('created_at', { ascending: false }).limit(50); if (error) throw error; return data;
  } });
  const rows = query.data ?? []; const unread = rows.filter(r => !r.read_at).length;
  return <Popover><PopoverTrigger asChild><Button variant="secondary" aria-label={`Centro notifiche, ${unread} da leggere`} title="Modifiche e disdette dei clienti"><Bell className="size-4" />{unread > 0 && <span>{unread}</span>}</Button></PopoverTrigger><PopoverContent className="max-h-96 w-80 max-w-[90vw] overflow-y-auto"><h2 className="mb-3 font-semibold">Notifiche di servizio</h2>{query.isError && <p role="alert">Notifiche non disponibili.</p>}{!query.isError && !rows.length && <p className="text-sm text-muted-foreground">Nessun avviso.</p>}{rows.map(r => <div key={r.id} className="border-t py-3 text-sm"><p className={r.read_at ? 'text-muted-foreground' : 'font-semibold'}>{r.message}</p><time className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('it-IT')}</time>{!r.read_at && <Button variant="ghost" size="sm" className="mt-1" onClick={async () => { const { error } = await supabase.from('service_notifications').update({ read_at: new Date().toISOString() }).eq('id', r.id).eq('restaurant_id', rid ?? ''); if (error) toast.error('Presa visione non salvata'); else await qc.invalidateQueries({ queryKey: ['service-notifications', rid] }); }}><Check />Presa visione</Button>}</div>)}</PopoverContent></Popover>;
}