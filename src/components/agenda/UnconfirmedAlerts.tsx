import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useServiceClock } from '@/lib/extras';
import { useBookingPolicy } from '@/hooks/use-booking-policy';
import { useActiveRestaurantId } from '@/lib/tenant';
import { useTables, type Reservation } from '@/lib/data';
import { unconfirmedWithinHour } from '@/lib/service-communications';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
export function UnconfirmedAlerts({ rows }: { rows: Reservation[] }) {
  const now = useServiceClock(); const policy = useBookingPolicy(); const rid = useActiveRestaurantId(); const qc = useQueryClient();
  const { data: tables = [] } = useTables(); const [busy, setBusy] = useState<string | null>(null);
  const alerts = rows.filter(r => unconfirmedWithinHour(r, now, policy.timezone));
  const act = async (r: Reservation, action: 'confirm' | 'release') => {
    if (!rid || (action === 'release' && !window.confirm(`Liberare il tavolo di ${r.name} per mancata riconferma?`))) return;
    setBusy(r.id);
    try { const { error } = await supabase.rpc('handle_unconfirmed_booking', { _rid: rid, _id: r.id, _action: action }); if (error) throw error; await Promise.all(['reservations', 'reservations-month', 'recycle-bin'].map(key => qc.invalidateQueries({ queryKey: [key] }))); toast.success(action === 'confirm' ? 'Presenza riconfermata' : 'Tavolo liberato'); }
    catch { toast.error('Operazione non completata: aggiorna la prenotazione e riprova.'); } finally { setBusy(null); }
  };
  if (!alerts.length) return null;
  return <section aria-label="Mancate riconferme" className="max-h-64 space-y-2 overflow-y-auto border-b border-destructive/40 bg-background p-3 text-foreground">
    {alerts.map(r => <div key={r.id} role="alert" className="border-l-4 border-destructive pl-3 text-sm"><p className="font-semibold text-destructive">⚠️ Mancata conferma: la prenotazione di {r.name} (Tavolo {r.table_ids.map(id => tables.find(t => t.id === id)?.name ?? '—').join('+') || 'da assegnare'}, {r.people} pax) è prevista {r.time} e non è stata riconfermata via email.</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" disabled={busy === r.id} onClick={() => act(r, 'confirm')}>Confermata manualmente / WhatsApp</Button><Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => act(r, 'release')}>Libera Tavolo (Mancata Conferma)</Button></div></div>)}
  </section>;
}