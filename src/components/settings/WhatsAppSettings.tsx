import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FieldHelp } from './FieldHelp';
import { getWhatsAppStatus, saveWhatsAppSettings, testWhatsApp } from '@/lib/whatsapp.functions';

type Status = Awaited<ReturnType<typeof getWhatsAppStatus>>;

export function WhatsAppSettings({ id }: { id: string }) {
  const get = useServerFn(getWhatsAppStatus);
  const q = useQuery({ queryKey: ['whatsapp-settings', id], queryFn: () => get({ data: { id } }) });
  if (q.isError) return <p role="alert" className="text-sm text-destructive">Impostazioni WhatsApp non disponibili.</p>;
  if (!q.data) return null;
  return <WhatsAppForm key={`${id}-${q.data.updated_at ?? ''}`} id={id} initial={q.data} />;
}

function WhatsAppForm({ id, initial }: { id: string; initial: Status }) {
  const save = useServerFn(saveWhatsAppSettings);
  const test = useServerFn(testWhatsApp);
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [phoneId, setPhoneId] = useState(initial.phone_number_id);
  const [display, setDisplay] = useState(initial.display_phone);
  const [template, setTemplate] = useState(initial.template_name);
  const [lang, setLang] = useState(initial.template_language);
  const [token, setToken] = useState('');
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const canEnable = !!phoneId && (initial.tokenSaved || !!token.trim());

  const persist = async (clearToken = false) => {
    setBusy(true);
    try {
      await save({ data: { id, token: clearToken ? '' : token, clearToken, settings: { enabled: enabled && canEnable, phone_number_id: phoneId.trim(), display_phone: display, template_name: template.trim(), template_language: lang.trim() || 'it' } } });
      setToken('');
      await qc.invalidateQueries({ queryKey: ['whatsapp-settings', id] });
      toast.success(clearToken ? 'Token rimosso: invio automatico disattivato' : 'WhatsApp Business salvato');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Impostazioni non salvate'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-3 border-y py-3">
    <div className="flex items-center justify-between gap-3">
      <h4 className="font-semibold">WhatsApp Business del ristorante</h4>
      <span className={`rounded-full px-2 py-0.5 text-xs ${initial.ready ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>{initial.ready ? 'Attivo' : 'Non attivo'}</span>
    </div>
    <p className="text-sm text-muted-foreground">Credenziali esclusive di questo ristorante, condivise da tutti i suoi Master e usate da ogni operatore (anche Staff) per inviare dal numero del locale. Gli altri ristoranti non possono vederle né usarle. Il token non viene mai mostrato dopo il salvataggio.</p>
    <label className="block text-sm">Numero visualizzato<Input value={display} onChange={e => setDisplay(e.target.value)} placeholder="+39 ..." /></label>
    <label className="block text-sm">Phone Number ID<Input inputMode="numeric" value={phoneId} onChange={e => setPhoneId(e.target.value.replace(/\D/g, ''))} placeholder="Es. 123456789012345" /><FieldHelp>Da Meta Business → WhatsApp Manager → API Setup.</FieldHelp></label>
    <label className="block text-sm">Token di accesso permanente<Input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder={initial.tokenSaved ? '•••••••• salvato (lascia vuoto per mantenerlo)' : 'Token System User di Meta'} /><FieldHelp>Viene cifrato e usato solo dal server.</FieldHelp></label>
    <div className="grid grid-cols-[1fr_6rem] gap-2">
      <label className="block text-sm">Modello promemoria approvato<Input value={template} onChange={e => setTemplate(e.target.value.toLowerCase())} placeholder="promemoria_prenotazione" /></label>
      <label className="block text-sm">Lingua<Input value={lang} onChange={e => setLang(e.target.value)} placeholder="it" /></label>
    </div>
    <FieldHelp>Meta permette di scrivere per primi ai clienti solo con un modello approvato. Il modello riceve nell’ordine: nome cliente, data, ora, persone. Senza modello si invia il testo libero, accettato solo se il cliente ha scritto al locale nelle ultime 24 ore.</FieldHelp>
    <label className="flex items-center justify-between gap-3 text-sm">Invio automatico dal numero del ristorante<Switch checked={enabled && canEnable} disabled={!canEnable} onCheckedChange={setEnabled} /></label>
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => void persist()}>Salva WhatsApp</Button>
      {initial.tokenSaved && <Button variant="outline" disabled={busy} onClick={() => void persist(true)}>Rimuovi token</Button>}
    </div>
    <div className="flex flex-wrap items-end gap-2">
      <label className="block flex-1 text-sm">Numero per la prova<Input type="tel" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="+39 333 ..." /></label>
      <Button variant="outline" disabled={busy || testTo.trim().length < 6} onClick={async () => { setBusy(true); try { const r = await test({ data: { id, to: testTo, phone_number_id: phoneId, token } }); if (r.ok) toast.success(r.message); else toast.error(r.message); } catch (e) { toast.error(e instanceof Error ? e.message : 'Prova non riuscita'); } finally { setBusy(false); } }}>Invia prova</Button>
    </div>
    <p className="text-xs text-muted-foreground">Finché non è attivo, i promemoria si aprono precompilati in WhatsApp sul dispositivo e si confermano a mano.</p>
  </div>;
}
