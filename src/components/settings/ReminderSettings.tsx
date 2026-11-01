import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FieldHelp } from './FieldHelp';
import { toast } from 'sonner';
export function ReminderSettings({ id }: { id: string }) {
  const query = useQuery({ queryKey: ['reminder-settings', id], queryFn: async () => { const { data, error } = await supabase.from('restaurants').select('morning_reminder_enabled,daily_summary_enabled,daily_summary_sent_at,daily_summary_error').eq('id', id).single(); if (error) throw error; return data; } });
  if (query.isError) return <p role="alert">Promemoria non disponibili.</p>;
  if (!query.data) return null;
  return <ReminderForm key={id} id={id} initial={query.data} />;
}
function ReminderForm({ id, initial }: { id: string; initial: { morning_reminder_enabled: boolean; daily_summary_enabled: boolean; daily_summary_sent_at: string | null; daily_summary_error: string | null } }) {
  const [morning, setMorning] = useState(initial.morning_reminder_enabled); const [summary, setSummary] = useState(initial.daily_summary_enabled); const [busy, setBusy] = useState(false); const qc = useQueryClient();
  return <section className="mb-6 space-y-4"><h3 className="font-display text-xl">Promemoria e riepilogo</h3>
    <div><label className="flex items-center justify-between gap-3 text-sm">Promemoria di riconferma ai clienti dalle 09:00<Switch checked={morning} onCheckedChange={setMorning} /></label><FieldHelp>Un messaggio per ciascuna prenotazione online accettata, con link sicuro di riconferma.</FieldHelp></div>
    <div><label className="flex items-center justify-between gap-3 text-sm">Riepilogo al ristorante alle 09:00<Switch checked={summary} onCheckedChange={setSummary} /></label><FieldHelp>Invia all’email principale o dedicata il riepilogo del giorno, con coperti, tavoli e note. Orario nel fuso del locale.</FieldHelp></div>
    {initial.daily_summary_sent_at && <p className="text-sm text-muted-foreground">Ultimo riepilogo inviato al server email: {new Date(initial.daily_summary_sent_at).toLocaleString('it-IT')}</p>}
    {initial.daily_summary_error && <p role="alert" className="text-sm text-destructive">{initial.daily_summary_error}</p>}
    <Button disabled={busy} onClick={async () => { setBusy(true); try { const { error } = await supabase.from('restaurants').update({ morning_reminder_enabled: morning, daily_summary_enabled: summary }).eq('id', id); if (error) throw error; await qc.invalidateQueries({ queryKey: ['reminder-settings', id] }); await qc.invalidateQueries({ queryKey: ['booking-policy', id] }); toast.success('Promemoria aggiornati'); } catch { toast.error('Promemoria non salvati'); } finally { setBusy(false); } }}>Salva promemoria</Button>
  </section>;
}