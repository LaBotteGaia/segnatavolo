import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Layers, Loader2, Mic, Save, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getAiSettings, parseAssignmentRules } from '@/lib/voice-ai.functions';
import { configurationError, normalizeAssignmentRules } from '@/lib/assignment-rules';
import { useMembership } from '@/lib/membership';

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const times = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2,'0')}:${String(i % 4 * 15).padStart(2,'0')}`);
export function AssignmentRulesEditor() {
  const { data: me } = useMembership();
  const qc = useQueryClient();
  const settings = me?.restaurants?.settings;
  const raw = settings && typeof settings === 'object' ? settings as Record<string, unknown> : {};
  const [rules, setRules] = useState(() => normalizeAssignmentRules(raw.assignmentRules));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(false);
  const [hint, setHint] = useState(true);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const load = useServerFn(getAiSettings), parse = useServerFn(parseAssignmentRules);
  const { data: ai } = useQuery({ queryKey: ['ai-settings', me?.restaurant_id], enabled: !!me?.restaurant_id, queryFn: () => load({ data: { id: me?.restaurant_id ?? '' } }) });
  useEffect(() => { setRules(normalizeAssignmentRules(raw.assignmentRules)); }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => rec.current?.abort(), []);
  const dictate = () => {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { toast.info('Microfono non supportato: scrivi la regola.'); return; }
    const r = new Ctor(); r.lang = 'it-IT'; r.continuous = false; r.interimResults = false;
    r.onresult = e => { const last = e.results[e.results.length-1]; setText((last?.[0]?.transcript ?? '').trim().replace(/\s+/g,' ')); };
    r.onend = () => { setListening(false); rec.current = null; };
    r.onerror = () => { toast.error('Dettatura non disponibile: controlla il permesso microfono.'); setListening(false); };
    rec.current = r; r.start(); setListening(true);
  };
  const translate = async () => {
    if (!me) return;
    setBusy(true);
    try { setRules(await parse({ data: { id: me.restaurant_id, text } })); setDraft(true); toast.success('Bozza pronta da verificare'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Regola non interpretabile'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!me) return;
    setBusy(true);
    // Read the latest object to preserve concurrently edited service settings.
    const { data: latest, error: readError } = await supabase.from('restaurants').select('settings').eq('id',me.restaurant_id).single();
    if (readError) { toast.error(configurationError(readError)); setBusy(false); return; }
    const preserved = latest.settings && typeof latest.settings === 'object' && !Array.isArray(latest.settings) ? latest.settings : {};
    const { data, error } = await supabase.from('restaurants').update({ settings: { ...preserved, assignmentRules: rules } }).eq('id',me.restaurant_id).select('id');
    setBusy(false);
    if (error || !data?.length) { toast.error(configurationError(error ?? { code:'42501' })); return; }
    await qc.invalidateQueries({ queryKey:['membership'] }); setDraft(false); toast.success('Regole di assegnazione salvate');
  };
  return <div className="space-y-6">
    {ai?.provider === 'gemini' && ai.keySaved ? <section className="space-y-3 border-b pb-6">
      <h2 className="flex items-center gap-2 font-display text-xl"><Sparkles className="size-5 text-primary" /> Configura con il linguaggio naturale</h2>
      <div className="flex items-start gap-2"><Textarea aria-label="Descrizione regole" value={text} onChange={e=>setText(e.target.value)} placeholder="Chi prenota dalle 21:00 in poi va nei tavoli isola o fuori…" rows={3}/><Button variant="outline" size="icon" aria-label={listening?'Termina ascolto':'Detta regole'} title="Detta regole" onClick={dictate}><Mic/></Button></div>
      {listening && <p role="status" className="text-sm text-primary">🎙️ Ti sto ascoltando… Parla liberamente</p>}
      <Button variant="secondary" disabled={busy || listening || text.trim().length<3} onClick={translate}><Sparkles/> Prepara bozza</Button>
    </section> : hint && <div className="flex items-center justify-between gap-3 border-b pb-4 text-sm text-muted-foreground"><span>Gemini non configurato · Regole manuali disponibili</span><Button size="icon" variant="ghost" aria-label="Nascondi suggerimento Gemini" onClick={()=>setHint(false)}><X/></Button></div>}
    {draft && <p role="status" className="border-l-4 border-warning bg-warning/10 p-3 text-sm font-semibold">Bozza Gemini · Verifica le regole prima di salvare</p>}
    <section className="space-y-4 border-b pb-6">
      <div className="flex items-center justify-between gap-4"><h2 className="flex items-center gap-2 font-display text-xl"><Clock3 className="size-5 text-primary"/> No-Turnover / Sedute Lunghe</h2><Switch aria-label="Attiva sedute lunghe" checked={rules.longStay.enabled} onCheckedChange={enabled=>setRules(r=>({...r,longStay:{...r.longStay,enabled}}))}/></div>
      <div className="flex flex-wrap items-center gap-3 text-sm"><span>Prenotazioni dalle</span><Select value={rules.longStay.from} disabled={!rules.longStay.enabled} onValueChange={from=>setRules(r=>({...r,longStay:{...r.longStay,from}}))}><SelectTrigger aria-label="Orario sedute lunghe" className="w-28"><SelectValue/></SelectTrigger><SelectContent>{times.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><span>oppure con nota di permanenza lunga</span></div>
      <div className="text-sm text-muted-foreground">Priorità: seduta lunga → isola → sala esterna → tavoli componibili.</div>
    </section>
    <section className="space-y-3 border-b pb-6"><div className="flex items-center justify-between gap-4"><h2 className="flex items-center gap-2 font-display text-xl"><Layers className="size-5 text-primary"/> Salvaguardia Tavoli Componibili</h2><Switch aria-label="Proteggi tavoli componibili" checked={rules.protectModular} onCheckedChange={protectModular=>setRules(r=>({...r,protectModular}))}/></div><div className="text-sm text-muted-foreground">2 o 3 persone · Tavoli isola liberi e sufficienti prima dei componibili.</div></section>
    <Button disabled={busy} onClick={save}>{busy?<Loader2 className="animate-spin"/>:<Save/>} Salva Regole</Button>
  </div>;
}