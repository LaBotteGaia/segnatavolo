import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ListChecks, Loader2, Mic, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { getAiSettings, parseCustomRule } from '@/lib/voice-ai.functions';
import { useCustomRules } from '@/lib/data';
import { storedRules, parsedRulesSchema, ruleTags, type ParsedRule } from '@/lib/custom-rules';
import { configurationError } from '@/lib/assignment-rules';
import { useMembership } from '@/lib/membership';

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

/** Regole personalizzate: dettatura/testo → bozza Gemini → conferma Master; elenco con attiva/disattiva ed elimina. */
export function CustomRulesPanel() {
  const { data: me } = useMembership();
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useCustomRules();
  const load = useServerFn(getAiSettings), parse = useServerFn(parseCustomRule);
  const { data: ai } = useQuery({ queryKey: ['ai-settings', me?.restaurant_id], enabled: !!me?.restaurant_id, queryFn: () => load({ data: { id: me?.restaurant_id ?? '' } }) });
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<ParsedRule[] | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const nextSubmit = useRef(0);
  const [draftText, setDraftText] = useState('');
  const [listening, setListening] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => () => rec.current?.abort(), []);
  const refresh = () => qc.invalidateQueries({ queryKey: ['custom-rules', me?.restaurant_id] });
  const gemini = ai?.provider === 'gemini' && ai.keySaved;

  const dictate = () => {
    if (busy || submitting.current) return;
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { toast.info('Microfono non supportato: scrivi la regola.'); return; }
    const r = new Ctor(); r.lang = 'it-IT'; r.continuous = false; r.interimResults = false;
    r.onresult = e => { const last = e.results[e.results.length - 1]; setText((last?.[0]?.transcript ?? '').trim().replace(/\s+/g, ' ')); setDraft(null); };
    r.onend = () => { setListening(false); rec.current = null; };
    r.onerror = () => { toast.error('Dettatura non disponibile: controlla il permesso microfono.'); setListening(false); };
    rec.current = r; r.start(); setListening(true);
  };
  const interpret = async () => {
    if (!me || submitting.current || Date.now() < nextSubmit.current) return;
    submitting.current = true; nextSubmit.current = Date.now() + 1000;
    setBusy(true); setDraft(null);
    const source = text.trim().replace(/\s+/g, ' ');
    try { setDraft(parsedRulesSchema.parse(await parse({ data: { id: me.restaurant_id, text: source } })).rules); setDraftText(source); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Regola non interpretabile'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const confirm = async () => {
    if (!me || !draft || submitting.current || Date.now() < nextSubmit.current) return;
    submitting.current = true; nextSubmit.current = Date.now() + 1000; setBusy(true);
    try {
      const logic = parsedRulesSchema.parse({ rules: draft });
      // Una sola riga per frase: tutte le condizioni restano nello stesso documento formalizzato.
      const { error } = await supabase.from('restaurant_assignment_rules').insert({ restaurant_id: me.restaurant_id, raw_text: draftText, parsed_logic: logic, is_active: true });
      if (error) { toast.error(error.code === '23505' ? 'Questa regola è già stata salvata negli ultimi 10 secondi.' : configurationError(error)); await refresh(); return; }
      setDraft(null); setText(''); await refresh(); toast.success('Regola salvata e applicata');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Regola non salvata'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const toggle = async (id: string, is_active: boolean) => {
    const { data, error } = await supabase.from('restaurant_assignment_rules').update({ is_active }).eq('id', id).eq('restaurant_id', me?.restaurant_id ?? '').select('id');
    if (error || !data?.length) toast.error(configurationError(error ?? { code: '42501' }));
    await refresh();
  };
  const remove = async () => {
    if (!toDelete || !me) return;
    const { data, error } = await supabase.from('restaurant_assignment_rules').delete().eq('id', toDelete).eq('restaurant_id', me.restaurant_id).select('id');
    setToDelete(null);
    if (error || !data?.length) { toast.error(configurationError(error ?? { code: '42501' })); return; }
    await refresh(); toast.success('Regola eliminata');
  };

  return <section className="space-y-4 border-b pb-6" aria-label="Regole personalizzate">
    <h2 className="flex items-center gap-2 font-display text-xl"><ListChecks className="size-5 text-primary" /> Regole personalizzate dei tavoli</h2>
    {gemini ? <>
      <div className="flex items-start gap-2">
        <Textarea aria-label="Testo regola personalizzata" rows={3} value={text} maxLength={1500} disabled={busy} onChange={e => { setText(e.target.value); setDraft(null); }} placeholder="Riserva i tavoli 1, 2 e 3 per comitive da 4, abbinando prima 1 con 2 e poi 2 con 3; le coppie sui tavoli non abbinabili in ordine crescente" />
        <Button variant="outline" size="icon" aria-label={listening ? 'Termina ascolto' : 'Detta regola personalizzata'} disabled={busy} onClick={dictate}><Mic /></Button>
      </div>
      {listening && <p role="status" className="text-sm text-primary">🎙️ Ti sto ascoltando… Parla liberamente</p>}
      <Button variant="secondary" disabled={busy || listening || text.trim().length < 3} onClick={interpret}>{busy && !draft ? <Loader2 className="animate-spin" /> : <Sparkles />} Interpreta regola</Button>
    </> : <p className="text-sm text-muted-foreground">Per dettare nuove regole inserisci la chiave Gemini nella scheda Integrazioni. Le regole già salvate restano gestibili qui sotto.</p>}

    {draft && <div aria-label="Verifica regola personalizzata" className="space-y-3 rounded-lg border-2 border-recommendation bg-card p-4 shadow-md">
      <h3 className="font-bold">🔍 Verifica prima di attivare</h3>
      {draft.map((r, i) => <div key={i} className="space-y-1"><p className="text-sm font-semibold">{r.human_summary}</p><Tags rule={r} /></div>)}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={confirm}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Salva e Applica</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setDraft(null)}><X /> Scarta</Button>
      </div>
    </div>}

    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase text-muted-foreground">Regole salvate ({rows.length})</h3>
      {isLoading && <Loader2 className="animate-spin" />}
      {!isLoading && !rows.length && <p className="text-sm text-muted-foreground">Nessuna regola personalizzata.</p>}
      {rows.map(row => {
        const parsed = storedRules(row.parsed_logic);
        return <article key={row.id} className={`space-y-2 rounded-lg border bg-card p-4 ${row.is_active ? '' : 'opacity-60'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              {parsed.map((r,i) => <div key={i} className="space-y-1"><p className="font-semibold">{r.human_summary}</p><Tags rule={r} /></div>)}
              <p className="text-sm italic text-muted-foreground break-words">“{row.raw_text}”</p>
              {!parsed.length ? <p className="text-sm text-destructive">Regola non valida: non viene applicata.</p> : null}
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs font-semibold">{row.is_active ? 'Attiva' : 'Spenta'}<Switch aria-label={`Attiva regola: ${row.raw_text}`} checked={row.is_active} onCheckedChange={v => toggle(row.id, v)} /></label>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setToDelete(row.id)}><Trash2 /> 🗑️ Elimina Regola</Button>
        </article>;
      })}
    </div>

    <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Eliminare la regola?</AlertDialogTitle><AlertDialogDescription>La regola verrà rimossa definitivamente e non sarà più applicata ai suggerimenti dei tavoli.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

function Tags({ rule }: { rule: ParsedRule }) {
  return <div className="flex flex-wrap gap-1.5">{ruleTags(rule).map(t => <span key={t} className="rounded-full border bg-secondary px-2.5 py-0.5 text-xs">{t}</span>)}</div>;
}
