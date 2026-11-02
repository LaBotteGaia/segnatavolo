import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useActiveRestaurantId } from '@/lib/tenant';
import { toast } from 'sonner';

export function ServiceNotifications() {
  const rid = useActiveRestaurantId(); const qc = useQueryClient();
  const query = useQuery({ queryKey: ['service-notifications', rid], enabled: !!rid, refetchInterval: 60000, queryFn: async () => {
    const { data, error } = await supabase.from('service_notifications').select('*, reservation:reservations(status, modification_status, deleted_at)').eq('restaurant_id', rid ?? '').is('read_at', null).order('created_at', { ascending: false }).limit(50);
    if (error) throw error; return data;
  } });
  const rows = query.data ?? [];
  // Change requests no longer pending (cancelled by customer, decided, deleted) are closed automatically.
  const stale = rows.filter(r => r.kind === 'change_requested' && (!r.reservation || r.reservation.deleted_at || r.reservation.status !== 'confirmed' || r.reservation.modification_status !== 'pending_modification')).map(r => r.id);
  const markRead = async (ids: string[], silent = false) => {
    if (!ids.length || !rid) return;
    const { error } = await supabase.from('service_notifications').update({ read_at: new Date().toISOString() }).in('id', ids).eq('restaurant_id', rid);
    if (error) { if (!silent) toast.error('Presa visione non salvata'); return; }
    await qc.invalidateQueries({ queryKey: ['service-notifications', rid] });
  };
  const staleKey = stale.join(',');
  useEffect(() => { if (staleKey) void markRead(staleKey.split(','), true); }, [staleKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = rows.filter(r => !stale.includes(r.id));
  const unread = visible.length;
  return <Popover><PopoverTrigger asChild><Button variant="secondary" aria-label={`Centro notifiche, ${unread} da leggere`} title="Modifiche e disdette dei clienti"><Bell className="size-4" />{unread > 0 && <span>{unread}</span>}</Button></PopoverTrigger><PopoverContent className="max-h-96 w-80 max-w-[90vw] overflow-y-auto"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">Notifiche di servizio</h2>{unread > 1 && <Button variant="ghost" size="sm" onClick={() => markRead(visible.map(r => r.id))}><CheckCheck />Segna tutte</Button>}</div>{query.isError && <p role="alert">Notifiche non disponibili.</p>}{!query.isError && !visible.length && <p className="text-sm text-muted-foreground">Nessun avviso.</p>}{visible.map(r => <div key={r.id} className="border-t py-3 text-sm"><p className="font-semibold">{r.message}</p><time className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('it-IT')}</time><Button variant="ghost" size="sm" className="mt-1" onClick={() => markRead([r.id])}><Check />Presa visione</Button></div>)}</PopoverContent></Popover>;
}
