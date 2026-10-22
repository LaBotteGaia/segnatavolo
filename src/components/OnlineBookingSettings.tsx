import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { onlineConfigSchema,slugFromName,slugSchema,type OnlineConfig } from '@/lib/online-booking';
export function OnlineBookingSettings({id,name}:{id:string;name:string}) {
 const {data,error}=useQuery({queryKey:['online-settings',id],queryFn:async()=>{const {data,error}=await supabase.from('restaurants').select('online_enabled,web_slug,online_config,public_address,public_logo_url').eq('id',id).single();if(error)throw error;return data;}});
 if(error)return <p role="alert">Impostazioni online non disponibili.</p>;
 if(!data)return <Loader2 className="size-5 animate-spin"/>;
 return <OnlineSettingsForm key={id} id={id} name={name} initial={data}/>;
}
function OnlineSettingsForm({id,name,initial}:{id:string;name:string;initial:{online_enabled:boolean;web_slug:string|null;online_config:unknown;public_address:string;public_logo_url:string}}) {
 const qc=useQueryClient();const [enabled,setEnabled]=useState(initial.online_enabled);const [slug,setSlug]=useState(initial.web_slug||slugFromName(name));const [cfg,setCfg]=useState<OnlineConfig>(()=>onlineConfigSchema.parse(initial.online_config));const [address,setAddress]=useState(initial.public_address);const [logo,setLogo]=useState(initial.public_logo_url);const [saving,setSaving]=useState(false);
 const link=`https://segnatavolo.lovable.app/prenota/${slug}`;const embed=`<iframe src="${link}" width="100%" height="800px" frameborder="0"></iframe>`;
 const patch=(p:Partial<OnlineConfig>)=>setCfg(c=>({...c,...p}));
 const save=async()=>{const valid=slugSchema.safeParse(slug);if(!valid.success){toast.error(valid.error.issues[0]?.message);return;}if(!onlineConfigSchema.safeParse(cfg).success){toast.error('Controlla le regole online');return;}setSaving(true);try{const {error}=await supabase.from('restaurants').update({online_enabled:enabled,web_slug:slug,online_config:cfg,public_address:address,public_logo_url:logo}).eq('id',id);if(error){toast.error(error.code==='23505'?'Identificativo già utilizzato da un altro locale':'Impostazioni non salvate: controlla i dati');return;}await qc.invalidateQueries({queryKey:['online-settings',id]});toast.success('Prenotazioni online aggiornate');}finally{setSaving(false);}};
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);toast.success('Copiato');}catch{toast.error('Copia non disponibile');}};
 return <section className="space-y-4 border-t pt-4"><h3 className="font-display text-lg">Prenotazioni Online &amp; Widget</h3>
 <label className="flex items-center justify-between gap-3 text-sm font-semibold">Abilita ricezione prenotazioni online<Switch checked={enabled} onCheckedChange={setEnabled}/></label>
 <label className="block text-sm">Identificativo Web (Slug)<Input value={slug} maxLength={80} onChange={e=>setSlug(e.target.value)}/></label>
 <label className="block text-sm">Indirizzo del locale<Input value={address} maxLength={300} onChange={e=>setAddress(e.target.value)}/></label>
 <label className="block text-sm">Logo (URL HTTPS)<Input type="url" value={logo} maxLength={1000} onChange={e=>setLogo(e.target.value)}/></label>
 <label className="block text-sm">Apertura prenotazioni (anticipo massimo)<Select value={String(cfg.max_days)} onValueChange={v=>patch({max_days:Number(v)})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[15,30,60,90].map(n=><SelectItem key={n} value={String(n)}>{n} giorni</SelectItem>)}</SelectContent></Select></label>
 <label className="block text-sm">Chiusura prenotazioni<Select value={cfg.cutoff} onValueChange={v=>patch({cutoff:v as OnlineConfig['cutoff']})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="hours">X ore prima dell’inizio servizio</SelectItem><SelectItem value="previous_day">Nessuna prenotazione in giornata</SelectItem><SelectItem value="24h">Almeno 24 ore prima del turno</SelectItem><SelectItem value="48h">Almeno 48 ore prima del turno</SelectItem></SelectContent></Select></label>
 {cfg.cutoff==='hours'&&<label className="block text-sm">Ore di anticipo<Input type="number" min={0} max={72} value={cfg.cutoff_hours} onChange={e=>patch({cutoff_hours:Number(e.target.value)})}/></label>}
 <label className="block text-sm">Messaggio di chiusura personalizzato<Textarea value={cfg.closed_message} maxLength={1000} onChange={e=>patch({closed_message:e.target.value})}/></label>
 <div className="space-y-2"><label className="block text-sm">Link pubblico<Input readOnly value={link}/></label><Button type="button" size="sm" variant="outline" onClick={()=>copy(link)}><Copy/>Copia link</Button><label className="block text-sm">Codice Iframe<Textarea readOnly value={embed}/></label><Button type="button" size="sm" variant="outline" onClick={()=>copy(embed)}><Copy/>Copia codice</Button></div>
 <Button type="button" disabled={saving} className="w-full" onClick={save}>{saving&&<Loader2 className="animate-spin"/>}Salva canale online</Button></section>;
}
