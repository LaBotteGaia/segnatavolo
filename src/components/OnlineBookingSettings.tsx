import { useState } from 'react';
import { BookingPolicyFields } from './BookingPolicyFields';
import { bookingPolicySchema, type BookingPolicy } from '@/lib/booking-policy';
import { contactOverrideSchema } from '@/lib/restaurant-identity';
import type { Tables } from '@/integrations/supabase/types';
import { FieldHelp } from './settings/FieldHelp';
import { ScheduleExceptions } from './settings/ScheduleExceptions';
import { exceptionsOf, scheduleExceptionsSchema } from '@/lib/schedule-exceptions';
import { normalizeSettings } from '@/lib/data';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { onlineConfigSchema,slugFromName,slugSchema,type OnlineConfig } from '@/lib/online-booking';
export function OnlineBookingSettings({id,name}:{id:string;name:string}) {
 const {data,error}=useQuery({queryKey:['online-settings',id],queryFn:async()=>{const {data,error}=await supabase.from('restaurants').select('*').eq('id',id).single();if(error)throw error;return data;}});
 if(error)return <p role="alert">Impostazioni online non disponibili.</p>;
 if(!data)return <Loader2 className="size-5 animate-spin"/>;
 return <OnlineSettingsForm key={id} id={id} name={name} initial={{...data,...bookingPolicySchema.parse(data)}}/>;
}
function OnlineSettingsForm({id,name,initial}:{id:string;name:string;initial:Tables<'restaurants'> & BookingPolicy}) {
 const qc=useQueryClient();const [enabled,setEnabled]=useState(initial.online_enabled);const [slug,setSlug]=useState(initial.web_slug||slugFromName(name));const [cfg,setCfg]=useState<OnlineConfig>(()=>onlineConfigSchema.parse(initial.online_config));const [overrides,setOverrides]=useState(()=>contactOverrideSchema.parse(initial));const [saving,setSaving]=useState(false);
 const [policy,setPolicy]=useState<BookingPolicy>(()=>bookingPolicySchema.parse(initial));
 const [exceptions,setExceptions]=useState(()=>exceptionsOf(initial.schedule_exceptions));
 const general=normalizeSettings(initial.settings);
 const webShifts=cfg.shifts??{pranzo:general.shifts.pranzo,sera:general.shifts.sera};
 const link=`https://segnatavolo.lovable.app/prenota/${slug}`;const embed=`<iframe src="${link}" width="100%" height="800px" frameborder="0"></iframe>`;
 const patch=(p:Partial<OnlineConfig>)=>setCfg(c=>({...c,...p}));
 const save=async()=>{const valid=slugSchema.safeParse(slug);if(!valid.success){toast.error(valid.error.issues[0]?.message);return;}const validatedPolicy=bookingPolicySchema.safeParse({...policy,timezone:initial.timezone,contact_phone:overrides.contact_phone,contact_whatsapp:overrides.contact_whatsapp,booking_window_days:cfg.max_days});if(!onlineConfigSchema.safeParse(cfg).success||!validatedPolicy.success||!scheduleExceptionsSchema.safeParse(exceptions).success||Object.values(webShifts).some(s=>s.from>=s.to)){toast.error('Controlla le regole online, le date e gli orari');return;}const ov=contactOverrideSchema.safeParse(overrides);if(!ov.success){toast.error(ov.error.issues[0]?.message);return;}setSaving(true);try{const {error}=await supabase.from('restaurants').update({online_enabled:enabled,web_slug:slug,online_config:cfg,schedule_exceptions:exceptions,...validatedPolicy.data,...ov.data}).eq('id',id);if(error){toast.error(error.code==='23505'?'Identificativo già utilizzato da un altro locale':'Impostazioni non salvate: controlla i dati e le finestre dei turni');return;}await qc.invalidateQueries();toast.success('Prenotazioni online aggiornate');}finally{setSaving(false);}};
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);toast.success('Copiato');}catch{toast.error('Copia non disponibile');}};
 return <section className="space-y-4 border-t pt-4"><h3 className="font-display text-lg">Prenotazioni Online &amp; Widget</h3>
 <label className="flex items-center justify-between gap-3 text-sm font-semibold">Abilita ricezione prenotazioni online<Switch checked={enabled} onCheckedChange={setEnabled}/><FieldHelp>Rende disponibile la pagina pubblica; da spento non riceve nuove richieste.</FieldHelp></label>
 <label className="block text-sm">Identificativo Web (Slug)<Input value={slug} maxLength={80} onChange={e=>setSlug(e.target.value)}/><FieldHelp>Indirizzo univoco del locale nel link pubblico.</FieldHelp></label>
 <fieldset className="space-y-3 border-y py-4"><legend className="font-semibold">Recapiti dedicati</legend>
 <label className="flex items-center justify-between gap-3 text-sm">Usa email dedicata per gestione prenotazioni<Switch checked={overrides.booking_email_override} onCheckedChange={v=>setOverrides(o=>({...o,booking_email_override:v}))}/></label><FieldHelp>Se spento, notifiche e riepiloghi vanno all’email principale del ristorante.</FieldHelp>
 {overrides.booking_email_override&&<label className="block text-sm">Email dedicata<Input required type="email" value={overrides.booking_email} onChange={e=>setOverrides(o=>({...o,booking_email:e.target.value}))}/><FieldHelp>Riceve nuove richieste, conferme, modifiche, disdette e riepilogo.</FieldHelp></label>}
 <label className="flex items-center justify-between gap-3 text-sm">Usa recapito telefonico/WhatsApp dedicato per prenotazioni online<Switch checked={overrides.booking_phone_override} onCheckedChange={v=>setOverrides(o=>({...o,booking_phone_override:v}))}/></label><FieldHelp>Se spento, il cliente vede i recapiti principali.</FieldHelp>
 {overrides.booking_phone_override&&<div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Telefono dedicato<Input type="tel" value={overrides.contact_phone} onChange={e=>setOverrides(o=>({...o,contact_phone:e.target.value}))}/><FieldHelp>Numero per contattare il servizio prenotazioni.</FieldHelp></label><label className="text-sm">WhatsApp dedicato<Input type="tel" value={overrides.contact_whatsapp} onChange={e=>setOverrides(o=>({...o,contact_whatsapp:e.target.value}))}/><FieldHelp>Numero per riconferme e comunicazioni online.</FieldHelp></label></div>}
 </fieldset>
 <label className="block text-sm">Apertura prenotazioni (giorni di anticipo massimo)<NumberInput min={1} max={365} defaultValue={30} value={cfg.max_days} onCommit={max_days=>patch({max_days})}/><FieldHelp>Numero massimo di giorni disponibili dopo oggi.</FieldHelp></label>
 <BookingPolicyFields value={policy} onChange={p=>setPolicy(current=>({...current,...p}))}/>
 <label className="block text-sm">Massimo coperti per prenotazione online<NumberInput min={1} max={100} defaultValue={6} value={cfg.max_party_size} onCommit={max_party_size=>patch({max_party_size})}/><FieldHelp>Limite per comitiva; la capienza residua può ridurlo.</FieldHelp></label>
 <label className="block text-sm">Chiusura prenotazioni<Select value={cfg.cutoff} onValueChange={v=>patch({cutoff:v as OnlineConfig['cutoff']})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="hours">X ore prima dell’inizio servizio</SelectItem><SelectItem value="previous_day">Nessuna prenotazione in giornata</SelectItem><SelectItem value="24h">Almeno 24 ore prima del turno</SelectItem><SelectItem value="48h">Almeno 48 ore prima del turno</SelectItem></SelectContent></Select><FieldHelp>Blocca gli arrivi troppo vicini all’inizio del servizio.</FieldHelp></label>
 {cfg.cutoff==='hours'&&<label className="block text-sm">Ore di anticipo<NumberInput min={0} max={72} defaultValue={2} value={cfg.cutoff_hours} onCommit={cutoff_hours=>patch({cutoff_hours})}/><FieldHelp>Anticipo minimo prima dell’inizio del turno.</FieldHelp></label>}
 {policy.online_turns_override&&<fieldset className="space-y-3"><legend className="font-semibold">Orari riservati all’online</legend>{(['pranzo','sera'] as const).map(s=><div key={s} className="space-y-2 border-b pb-3"><label className="flex items-center justify-between gap-3 text-sm">{s==='pranzo'?'Pranzo':'Cena'} online<Switch checked={webShifts[s].enabled} onCheckedChange={enabled=>patch({shifts:{...webShifts,[s]:{...webShifts[s],enabled}}})}/></label><div className="grid grid-cols-2 gap-3">{(['from','to'] as const).map(k=><label key={k} className="text-sm">{k==='from'?'Primo arrivo':'Ultimo arrivo'}<Input type="time" step={900} value={webShifts[s][k]} onChange={e=>patch({shifts:{...webShifts,[s]:{...webShifts[s],[k]:e.target.value}}})}/></label>)}</div></div>)}{policy.enable_double_shift&&<><h4 className="font-semibold">Orari web con doppio turno</h4>{(['pranzo','sera'] as const).map(s=><div key={s} className="grid grid-cols-2 gap-3"><label className="text-sm">{s==='pranzo'?'Pranzo':'Cena'} · Ultimo arrivo 1° Turno<Input type="time" step={900} value={cfg.double_windows[s].first_to} onChange={e=>patch({double_windows:{...cfg.double_windows,[s]:{...cfg.double_windows[s],first_to:e.target.value}}})}/></label><label className="text-sm">Primo arrivo 2° Turno<Input type="time" step={900} value={cfg.double_windows[s].second_from} onChange={e=>patch({double_windows:{...cfg.double_windows,[s]:{...cfg.double_windows[s],second_from:e.target.value}}})}/></label></div>)}</>}</fieldset>}
 <ScheduleExceptions value={exceptions} onChange={setExceptions}/>
 <label className="block text-sm">Messaggio di chiusura personalizzato<Textarea value={cfg.closed_message} maxLength={1000} onChange={e=>patch({closed_message:e.target.value})}/><FieldHelp>Messaggio mostrato quando non è più possibile prenotare online.</FieldHelp></label>
 <div className="space-y-2"><label className="block text-sm">Link pubblico<Input readOnly value={link}/><FieldHelp>Pagina da condividere con i clienti.</FieldHelp></label><Button type="button" size="sm" variant="outline" onClick={()=>copy(link)}><Copy/>Copia link</Button><label className="block text-sm">Codice Iframe<Textarea readOnly value={embed}/><FieldHelp>Codice per incorporare il modulo nel sito del ristorante.</FieldHelp></label><Button type="button" size="sm" variant="outline" onClick={()=>copy(embed)}><Copy/>Copia codice</Button></div>
 <Button type="button" disabled={saving} className="w-full" onClick={save}>{saving&&<Loader2 className="animate-spin"/>}Salva canale online</Button></section>;
}
