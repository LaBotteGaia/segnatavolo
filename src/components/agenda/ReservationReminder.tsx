import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useActiveRestaurantId } from '@/lib/tenant';
import type { Reservation } from '@/lib/data';
import { reminderChoice, type ReminderChannel, type ReminderDefault, type ReminderPreference } from '@/lib/reminder-channels';
import { sendReservationReminder } from '@/lib/reservation-reminder.functions';

export function ReservationReminder({ booking, onUpdate }: { booking: Reservation; onUpdate: (patch: Partial<Reservation>) => void }) {
  const rid = useActiveRestaurantId();
  const [choose,setChoose] = useState(false);
  const [busy,setBusy] = useState(false);
  const send = useServerFn(sendReservationReminder);
  const qc = useQueryClient();
  const contact = useQuery({ queryKey:['reminder-contact',rid,booking.customer_id], enabled:!!rid && !!booking.customer_id, queryFn:async()=> {
    const { data,error } = await supabase.from('customers').select('email').eq('restaurant_id',rid ?? '').eq('id',booking.customer_id ?? '').maybeSingle();
    if(error) throw error; return data;
  }});
  const defaults = useQuery({ queryKey:['reminder-default',rid],enabled:!!rid,queryFn:async()=> {
    const { data,error } = await supabase.from('restaurants').select('reminder_default_channel').eq('id',rid ?? '').single();
    if(error) throw error; return data;
  }});
  const logs = useQuery({queryKey:['reminder-logs',rid,booking.id],enabled:!!rid,queryFn:async()=> {
    const {data,error}=await supabase.from('reservation_reminder_logs').select('channel,outcome,created_at,detail').eq('restaurant_id',rid ?? '').eq('reservation_id',booking.id).order('created_at',{ascending:false}).limit(5);
    if(error) throw error;return data;
  }});
  const phone = booking.phone;
  const email = booking.contact_email || contact.data?.email || null;
  const preference: ReminderPreference = booking.reminder_channel === 'email' || booking.reminder_channel === 'whatsapp' ? booking.reminder_channel : 'automatic';
  const defaultChannel: ReminderDefault = defaults.data?.reminder_default_channel === 'email' || defaults.data?.reminder_default_channel === 'whatsapp' ? defaults.data.reminder_default_channel : 'ask';
  const dispatch = async (channel:ReminderChannel) => {
    if(!rid || busy) return;
    // Open synchronously from the tap so browsers do not block the WhatsApp window.
    const popup = channel === 'whatsapp' ? window.open('about:blank','_blank') : null;
    if(popup) popup.opener = null;
    setBusy(true);
    try {
      const result=await send({data:{restaurantId:rid,reservationId:booking.id,channel}});
      if(result.url) {
        if(popup) popup.location.href=result.url; else window.location.assign(result.url);
        toast.info(result.message);
      } else { popup?.close(); result.sent ? toast.success(result.message) : toast.error(result.message); }
      setChoose(false);
      await qc.invalidateQueries({queryKey:['reminder-logs',rid,booking.id]});
    } catch(e) { popup?.close();toast.error(e instanceof Error ? e.message : 'Promemoria non inviato'); }
    finally {setBusy(false);}
  };
  return <div className="space-y-2">
    <label className="block text-xs font-semibold">Canale promemoria<Select value={preference} onValueChange={value=>{if(value==='automatic'||value==='email'||value==='whatsapp') onUpdate({reminder_channel:value});}}><SelectTrigger aria-label="Canale promemoria della prenotazione"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="automatic">Automatico</SelectItem><SelectItem value="whatsapp">Solo WhatsApp</SelectItem><SelectItem value="email">Solo Email</SelectItem></SelectContent></Select></label>
    <div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={busy || !phone} onClick={()=>void dispatch('whatsapp')}><MessageCircle/>WhatsApp</Button><Button disabled={busy || defaults.isPending || (!!booking.customer_id && !booking.contact_email && contact.isPending)} onClick={()=>{const choice=reminderChoice(phone,email,preference,defaultChannel);if(choice==='ask')setChoose(true);else if(choice==='unavailable')toast.error('Manca un recapito del cliente');else void dispatch(choice);}}><Send/>{busy?'Preparazione…':'Invia Promemoria'}</Button></div>
    {logs.data?.map((log,index)=><p key={`${log.created_at}-${index}`} className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString('it-IT')} · {log.channel==='email'?'Email':'WhatsApp'} · {log.outcome==='opened'?'Messaggio preparato, invio manuale':log.outcome==='accepted'?'Accettato dal server email':log.outcome==='failed'?`Non inviato: ${log.detail ?? ''}`:'Esito da verificare'}</p>)}
    <Dialog open={choose} onOpenChange={value=>!busy&&setChoose(value)}><DialogContent><DialogHeader><DialogTitle>Invia promemoria a {booking.name}</DialogTitle></DialogHeader><div className="grid gap-2"><Button variant="outline" disabled={busy||!phone} className="h-auto whitespace-normal py-3" onClick={()=>void dispatch('whatsapp')}><MessageCircle/><span className="break-all">WhatsApp · {phone}</span></Button><Button disabled={busy||!email} className="h-auto whitespace-normal py-3" onClick={()=>void dispatch('email')}><Mail/><span className="break-all">Email · {email}</span></Button></div></DialogContent></Dialog>
  </div>;
}