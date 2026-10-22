import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Loader2, Mail, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { emailSettingsSchema, SMTP_HOSTS, EMAIL_PLACEHOLDERS, type EmailSettings } from '@/lib/restaurant-email';
import { getRestaurantEmail, saveRestaurantEmail, testRestaurantEmail } from '@/lib/restaurant-email.functions';

export function RestaurantEmailSettings({ id }: { id: string }) {
  const get = useServerFn(getRestaurantEmail);
  const query = useQuery({ queryKey: ['restaurant-email', id], queryFn: () => get({ data: { id } }) });
  if (query.isError) return <p role="alert">Configurazione posta non disponibile.</p>;
  if (!query.data) return <Loader2 className="animate-spin" />;
  return <EmailForm key={id} id={id} initial={query.data.settings} passwordSaved={query.data.passwordSaved} />;
}
function EmailForm({ id, initial, passwordSaved }: { id: string; initial: EmailSettings; passwordSaved: boolean }) {
  const [cfg, setCfg] = useState(initial);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveRestaurantEmail);
  const test = useServerFn(testRestaurantEmail);
  const qc = useQueryClient();
  const patch = (v: Partial<EmailSettings>) => setCfg(current => ({ ...current, ...v }));
  const persist = async (trySend: boolean) => {
    const valid = emailSettingsSchema.safeParse(cfg);
    if (!valid.success) { toast.error(valid.error.issues[0]?.message ?? 'Controlla la configurazione'); return; }
    setBusy(true);
    try {
      await save({ data: { id, settings: valid.data, password } });
      setPassword('');
      await qc.invalidateQueries({ queryKey: ['restaurant-email', id] });
      if (trySend) { const result = await test({ data: { id } }); if (result.sent) toast.success(result.message); else toast.error(result.message); }
      else toast.success('Configurazione posta salvata');
    } catch { toast.error('Configurazione posta non aggiornata. Riprova.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 border-t pt-4"><h3 className="font-display text-lg">Configurazione Email</h3>
    <label className="block text-sm">Email notifica ristorante / maître<Input type="email" value={cfg.staffEmail} maxLength={255} onChange={e => patch({ staffEmail: e.target.value })} /></label>
    <label className="block text-sm">Telefono ristorante<Input type="tel" value={cfg.restaurantPhone} maxLength={40} onChange={e => patch({ restaurantPhone: e.target.value })} /></label>
    <Tabs defaultValue="pending"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="pending">Richiesta in attesa</TabsTrigger><TabsTrigger value="confirmed">Conferma</TabsTrigger><TabsTrigger value="rejected">Rifiuto</TabsTrigger></TabsList>
      {(['pending','confirmed','rejected'] as const).map(status => <TabsContent key={status} value={status} className="space-y-3">
        <label className="block text-sm">Oggetto<Input value={cfg.templates[status].subject} maxLength={300} onChange={e => patch({ templates: { ...cfg.templates, [status]: { ...cfg.templates[status], subject: e.target.value } } })} /></label>
        <label className="block text-sm">Corpo del messaggio<Textarea className="min-h-48" value={cfg.templates[status].body} maxLength={10000} onChange={e => patch({ templates: { ...cfg.templates, [status]: { ...cfg.templates[status], body: e.target.value } } })} /></label>
        <div className="flex flex-wrap gap-1">{EMAIL_PLACEHOLDERS.map(key => <Button key={key} type="button" size="sm" variant="ghost" onClick={() => patch({ templates: { ...cfg.templates, [status]: { ...cfg.templates[status], body: cfg.templates[status].body + `{${key}}` } } })}>{`{${key}}`}</Button>)}</div>
      </TabsContent>)}
    </Tabs>
    <label className="flex items-center justify-between gap-3 text-sm font-semibold">Usa server di posta personalizzato (SMTP)<Switch checked={cfg.custom} onCheckedChange={custom => patch({ custom })} /></label>
    {!cfg.custom ? <label className="block text-sm">Servizio email predefinito<Select value={cfg.provider} onValueChange={value => patch({ provider: value === 'resend' ? 'resend' : 'lovable' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lovable">Email Lovable</SelectItem><SelectItem value="resend">Resend</SelectItem></SelectContent></Select><span className="mt-2 block text-muted-foreground">{cfg.provider === 'lovable' ? 'Dominio mittente non ancora configurato.' : 'Resend non ancora collegato.'}</span></label> : <>
      <label className="block text-sm">Host SMTP<Select value={cfg.host} onValueChange={host => patch({ host })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SMTP_HOSTS.map(host => <SelectItem key={host} value={host}>{host}</SelectItem>)}</SelectContent></Select></label>
      <label className="block text-sm">Porta e sicurezza<Select value={String(cfg.port)} onValueChange={port => patch({ port: port === '465' ? 465 : 587, security: port === '465' ? 'tls' : 'starttls' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="465">465 — SSL/TLS</SelectItem><SelectItem value="587">587 — STARTTLS</SelectItem></SelectContent></Select></label>
      <label className="block text-sm">Nome mittente<Input value={cfg.senderName} maxLength={150} onChange={e => patch({ senderName: e.target.value })} /></label>
      <label className="block text-sm">Email mittente / Username<Input type="email" value={cfg.username} maxLength={255} autoComplete="off" onChange={e => patch({ username: e.target.value })} /></label>
      <label className="block text-sm">Password SMTP<Input type="password" value={password} maxLength={1000} autoComplete="new-password" placeholder={passwordSaved ? 'Password salvata — lascia vuoto per mantenerla' : 'Password del server di posta'} onChange={e => setPassword(e.target.value)} /></label>
    </>}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => persist(false)}>{busy ? <Loader2 className="animate-spin" /> : <Save />}Salva posta</Button><Button type="button" disabled={busy} onClick={() => persist(true)}><Mail />Invia email di prova</Button></div>
  </section>;
}