import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FieldHelp } from './FieldHelp';
import { disconnectWhatsApp, getWhatsAppStatus, saveWhatsAppSettings, testWhatsApp, whatsappExchangeToken } from '@/lib/whatsapp.functions';

type Status = Awaited<ReturnType<typeof getWhatsAppStatus>>;

const META_APP_ID = '1046011691792824';
const META_CONFIG_ID = '1131196182945424';

type FbLoginResponse = { authResponse?: { code?: string } };
type FbSdk = {
  init: (opts: Record<string, unknown>) => void;
  login: (cb: (r: FbLoginResponse) => void, opts: Record<string, unknown>) => void;
};
declare global {
  interface Window { FB?: FbSdk; fbAsyncInit?: () => void }
}

/** Carica una sola volta l'SDK di Facebook e inizializza l'app Meta della piattaforma. */
function useFacebookSdk() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.FB) { setReady(true); return; }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: 'v21.0' });
      setReady(true);
    };
    if (document.getElementById('facebook-jssdk')) return;
    const s = document.createElement('script');
    s.id = 'facebook-jssdk';
    s.src = 'https://connect.facebook.net/it_IT/sdk.js';
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  }, []);
  return ready;
}

const WHATSAPP_COMING_SOON = true;

export function WhatsAppSettings({ id }: { id: string }) {
  if (WHATSAPP_COMING_SOON) return (
    <section aria-disabled="true" className="space-y-2 rounded-lg border border-dashed bg-muted/40 p-4 opacity-80">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold">WhatsApp Business del ristorante</h4>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">Prossimamente</span>
      </div>
      <p className="text-sm text-muted-foreground">Il collegamento del numero WhatsApp Business del locale per l’invio automatico dei promemoria è in fase di completamento e sarà disponibile in un prossimo aggiornamento.</p>
      <p className="text-xs text-muted-foreground">Nel frattempo i promemoria WhatsApp si aprono precompilati sul dispositivo e si inviano a mano.</p>
    </section>
  );
  return <WhatsAppSettingsLive id={id} />;
}

function WhatsAppSettingsLive({ id }: { id: string }) {
  const get = useServerFn(getWhatsAppStatus);
  const q = useQuery({ queryKey: ['whatsapp-settings', id], queryFn: () => get({ data: { id } }) });
  if (q.isError) return <p role="alert" className="text-sm text-destructive">Impostazioni WhatsApp non disponibili.</p>;
  if (!q.data) return null;
  return <WhatsAppForm key={`${id}-${q.data.updated_at ?? ''}`} id={id} initial={q.data} />;
}

function WhatsAppForm({ id, initial }: { id: string; initial: Status }) {
  const save = useServerFn(saveWhatsAppSettings);
  const test = useServerFn(testWhatsApp);
  const exchange = useServerFn(whatsappExchangeToken);
  const disconnect = useServerFn(disconnectWhatsApp);
  const qc = useQueryClient();
  const fbReady = useFacebookSdk();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [phoneId, setPhoneId] = useState(initial.phone_number_id);
  const [display, setDisplay] = useState(initial.display_phone);
  const [template, setTemplate] = useState(initial.template_name);
  const [lang, setLang] = useState(initial.template_language);
  const [token, setToken] = useState('');
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const pendingSignup = useRef<{ code: string } | null>(null);
  const canEnable = !!phoneId && (initial.tokenSaved || !!token.trim());

  const refresh = () => qc.invalidateQueries({ queryKey: ['whatsapp-settings', id] });

  // Meta Embedded Signup: al FINISH arrivano phone_number_id e waba_id; il codice arriva dal callback di FB.login.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (data.event === 'FINISH') {
          const pending = pendingSignup.current;
          pendingSignup.current = null;
          if (!pending?.code || !data.data?.phone_number_id || !data.data?.waba_id) {
            toast.error('Collegamento incompleto: dati Meta mancanti. Riprova.');
            setConnecting(false);
            return;
          }
          void (async () => {
            try {
              const r = await exchange({ data: { id, code: pending.code, phone_number_id: String(data.data.phone_number_id), waba_id: String(data.data.waba_id) } });
              if (r.ok) { toast.success(r.message); await refresh(); } else toast.error(r.message);
            } catch (e) { toast.error(e instanceof Error ? e.message : 'Collegamento non riuscito'); }
            finally { setConnecting(false); }
          })();
        } else if (data.event === 'CANCEL' || data.event === 'ERROR') {
          pendingSignup.current = null;
          setConnecting(false);
          if (data.event === 'ERROR') toast.error('Meta ha segnalato un errore durante il collegamento.');
        }
      } catch { /* messaggio non JSON: ignorato */ }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [id, exchange, qc]);

  const startSignup = () => {
    if (!window.FB) { toast.error('SDK Meta non ancora caricato: riprova tra un istante.'); return; }
    setConnecting(true);
    window.FB.login((response) => {
      const code = response.authResponse?.code;
      if (!code) { setConnecting(false); toast.error('Collegamento annullato o codice non ricevuto.'); return; }
      pendingSignup.current = { code };
    }, {
      config_id: META_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: { feature: 'whatsapp_embedded_signup', sessionInfoVersion: '3' },
    });
  };

  const persist = async (clearToken = false) => {
    setBusy(true);
    try {
      await save({ data: { id, token: clearToken ? '' : token, clearToken, settings: { enabled: enabled && canEnable, phone_number_id: phoneId.trim(), display_phone: display, template_name: template.trim(), template_language: lang.trim() || 'it' } } });
      setToken('');
      await refresh();
      toast.success(clearToken ? 'Token rimosso: invio automatico disattivato' : 'WhatsApp Business salvato');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Impostazioni non salvate'); }
    finally { setBusy(false); }
  };

  const toggleEnabled = async (next: boolean) => {
    setEnabled(next);
    setBusy(true);
    try {
      await save({ data: { id, token: '', clearToken: false, settings: { enabled: next, phone_number_id: initial.phone_number_id, display_phone: initial.display_phone, template_name: initial.template_name, template_language: initial.template_language } } });
      await refresh();
      toast.success(next ? 'Promemoria automatici attivi' : 'Promemoria automatici sospesi');
    } catch (e) { setEnabled(!next); toast.error(e instanceof Error ? e.message : 'Impostazioni non salvate'); }
    finally { setBusy(false); }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const r = await test({ data: { id, to: testTo, phone_number_id: phoneId, token } });
      if (r.ok) toast.success(r.message); else toast.error(r.message);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Prova non riuscita'); }
    finally { setBusy(false); }
  };

  const doDisconnect = async () => {
    if (!window.confirm('Scollegare il numero WhatsApp Business del ristorante? I promemoria torneranno al messaggio precompilato manuale.')) return;
    setBusy(true);
    try {
      await disconnect({ data: { id } });
      await refresh();
      toast.success('WhatsApp Business scollegato');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Scollegamento non riuscito'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-3 border-y py-3">
    <div className="flex items-center justify-between gap-3">
      <h4 className="font-semibold">WhatsApp Business del ristorante</h4>
      <span className={`rounded-full px-2 py-0.5 text-xs ${initial.connected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>{initial.connected ? 'Connesso' : 'Non collegato'}</span>
    </div>
    <p className="text-sm text-muted-foreground">Linea esclusiva di questo ristorante, usata da ogni operatore (anche Staff) per inviare dal numero del locale. Gli altri ristoranti non possono vederla né usarla. Il token non viene mai mostrato dopo il salvataggio.</p>

    {!initial.connected && (
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <p className="text-sm">Collega il numero WhatsApp Business del locale con la procedura guidata di Meta: puoi mantenere l’app WhatsApp Business sul telefono (coesistenza) e usare anche l’invio automatico da Segnatavolo.</p>
        <Button className="w-full bg-[#25D366] text-white hover:bg-[#1fb959] sm:w-auto" disabled={connecting || !fbReady} onClick={startSignup}>
          {connecting ? 'Collegamento in corso…' : 'Collega WhatsApp Business (con Coesistenza)'}
        </Button>
        <FieldHelp>Si apre la finestra ufficiale di Meta: accedi, scegli il numero del ristorante e conferma. Le credenziali vengono salvate cifrate in automatico.</FieldHelp>
      </div>
    )}

    {initial.connected && (
      <div className="space-y-3">
        <p className="text-sm">Numero collegato: <strong>{initial.display_phone || initial.phone_number_id}</strong></p>
        <label className="flex items-center justify-between gap-3 text-sm">Invio automatico dei promemoria dal numero del ristorante<Switch checked={enabled} disabled={busy} onCheckedChange={(v) => void toggleEnabled(v)} /></label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 text-sm">Numero per la prova<Input type="tel" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="+39 333 ..." /></label>
          <Button variant="outline" disabled={busy || testTo.trim().length < 6} onClick={() => void sendTest()}>Invia messaggio di prova</Button>
        </div>
        <FieldHelp>La prova usa il modello promemoria del ristorante con dati di esempio (nome, data, ora, persone).</FieldHelp>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy || !fbReady || connecting} onClick={startSignup}>Aggiorna collegamento</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void doDisconnect()}>Scollega</Button>
        </div>
      </div>
    )}

    <button type="button" className="text-sm text-primary underline" onClick={() => setShowManual(v => !v)}>
      {showManual ? 'Nascondi configurazione manuale' : 'Configurazione manuale (avanzata)'}
    </button>

    {showManual && (
      <div className="space-y-3">
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
          {!initial.connected && (
            <>
              <label className="block flex-1 text-sm">Numero per la prova<Input type="tel" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="+39 333 ..." /></label>
              <Button variant="outline" disabled={busy || testTo.trim().length < 6} onClick={() => void sendTest()}>Invia prova</Button>
            </>
          )}
        </div>
      </div>
    )}
    <p className="text-xs text-muted-foreground">Finché non è collegato, i promemoria si aprono precompilati in WhatsApp sul dispositivo e si confermano a mano.</p>
  </div>;
}
