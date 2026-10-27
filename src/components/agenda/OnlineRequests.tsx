import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useActiveRestaurantId } from '@/lib/tenant';
import { useSettings } from '@/lib/membership';
import { NO_EXTRAS, useRooms, useTables, wallsOf, type Reservation, type TableExtras } from '@/lib/data';
import { suggestTables } from '@/lib/allocation';
import { decideOnlineBooking } from '@/lib/online-approval.functions';
import { TableDialog } from './TableDialog';

export function OnlineRequests() {
  const restaurantId = useActiveRestaurantId();
  const qc = useQueryClient();
  const decide = useServerFn(decideOnlineBooking);
  const { data: rooms } = useRooms();
  const { data: tables } = useTables();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [assign, setAssign] = useState<Reservation | null>(null);
  const [reject, setReject] = useState<Reservation | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [extras, setExtras] = useState<TableExtras>(NO_EXTRAS);
  const requests = useQuery({ queryKey: ['online-requests', restaurantId], enabled: !!restaurantId, queryFn: async () => {
    const { data, error } = await supabase.from('reservations').select('*').eq('restaurant_id', restaurantId ?? '').eq('channel', 'online').eq('status', 'pending').is('deleted_at', null).order('date').order('time');
    if (error) throw error;
    return data;
  } });
  const occupied = useQuery({ queryKey: ['approval-occupied', restaurantId, assign?.date], enabled: !!restaurantId && !!assign, queryFn: async () => {
    const { data, error } = await supabase.from('reservations').select('*').eq('restaurant_id', restaurantId ?? '').eq('date', assign?.date ?? '').eq('status', 'confirmed').is('deleted_at', null);
    if (error) throw error;
    return data;
  } });
  const prepare = async (r: Reservation) => {
    if (!restaurantId || !tables || !rooms) return;
    const { data, error } = await supabase.from('reservations').select('*').eq('restaurant_id', restaurantId).eq('date', r.date).eq('status', 'confirmed').is('deleted_at', null);
    if (error) { toast.error('Disponibilità non raggiungibile'); return; }
    const suggestion = suggestTables({ people: r.people, date: r.date, shift: r.shift, time: r.time, tables, rooms, others: data, cfg: settings, outside: r.outside, notes:r.notes, rules:settings.assignmentRules, customRules, wallsFor: id => wallsOf(rooms.find(room => room.id === id)), me: r });
    setExtras(suggestion?.extras ?? NO_EXTRAS);
    setAssign({ ...r, table_ids: suggestion?.ids ?? [] });
  };
  const save = async (r: Reservation, accept: boolean, ids: string[], ex: TableExtras) => {
    if (!restaurantId || busy) return;
    setBusy(true);
    try {
      const result = await decide({ data: { restaurantId, id: r.id, accept, tables: ids, extras: ex, reason } });
      if (!result.ok) { toast.error(result.error); return; }
      setAssign(null); setReject(null); setReason('');
      await qc.invalidateQueries();
      toast.success(accept ? 'Prenotazione confermata e tavolo assegnato' : 'Richiesta rifiutata');
      if (!result.email.sent) toast.warning(result.email.message);
    } catch { toast.error('Connessione interrotta: verifica lo stato della richiesta prima di riprovare.'); }
    finally { setBusy(false); }
  };
  if (requests.isError) return <p role="alert" className="border-l-4 border-warning bg-paper p-3 text-foreground">Richieste online non raggiungibili.</p>;
  if (!requests.data?.length) return null;
  return <>
    <Button variant="secondary" className="mb-4 h-auto w-full justify-start whitespace-normal border border-warning py-3 text-left" onClick={() => setOpen(true)}><AlertTriangle className="shrink-0" />{requests.data.length} Prenotazioni online in attesa di approvazione</Button>
    <Dialog open={open} onOpenChange={value => !busy && setOpen(value)}><DialogContent className="max-h-[85vh] overflow-y-auto bg-paper"><DialogHeader><DialogTitle>Richieste online in attesa</DialogTitle></DialogHeader>
      {requests.data.map(r => <section key={r.id} className="space-y-2 border-b py-4"><h3 className="font-semibold">{r.name} · {r.people} coperti</h3><p className="text-sm">{r.date.split('-').reverse().join('/')} · {r.shift === 'pranzo' ? 'Pranzo' : 'Cena'} · {r.time}</p><p className="break-words text-sm">{r.notes}</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => prepare(r)}><Check />Accetta e Assegna</Button><Button disabled={busy} variant="outline" onClick={() => { setReason(''); setReject(r); }}><X />Rifiuta</Button></div></section>)}
    </DialogContent></Dialog>
    {assign && <TableDialog open={!busy} onOpenChange={value => !value && !busy && setAssign(null)} date={assign.date} reservation={assign} others={occupied.data ?? []} extras={extras} onConfirm={(ids, ex) => { void save(assign, true, ids, ex); }} />}
    <Dialog open={!!reject} onOpenChange={value => !value && !busy && setReject(null)}><DialogContent className="bg-paper"><DialogHeader><DialogTitle>Rifiuta richiesta di {reject?.name}</DialogTitle></DialogHeader><label className="text-sm">Motivazione<Textarea value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} /></label><Button disabled={busy || reason.trim().length < 2} variant="destructive" onClick={() => reject && save(reject, false, [], NO_EXTRAS)}>{busy ? <Loader2 className="animate-spin" /> : <X />}Conferma rifiuto</Button></DialogContent></Dialog>
  </>;
}