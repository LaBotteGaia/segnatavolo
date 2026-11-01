import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CircleHelp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RestaurantGate } from "@/components/RestaurantGate";
import { AssignmentRulesEditor } from "@/components/AssignmentRulesEditor";
import { OnlineBookingSettings } from "@/components/OnlineBookingSettings";
import { SpacesEditor } from "@/components/settings/SpacesEditor";
import { ServiceSettingsForm } from "@/components/settings/ServiceSettingsForm";
import { RestaurantProfileForm } from "@/components/settings/RestaurantProfileForm";
import { useMembership } from "@/lib/membership";
import { useIsSuperAdmin } from "@/lib/assist";

const TABS = [
  ["spazi", "🏛️ Spazi & Tavoli"],
  ["orari", "⏱️ Orari & Turni"],
  ["regole", "🧠 Regole Sala"],
  ["integrazioni", "🔌 Integrazioni"],
  ["dati", "ℹ️ Dati Ristorante"],
] as const;
type Tab = (typeof TABS)[number][0];
/** Mini guida mostrata in cima a ogni scheda e come suggerimento sul titolo della scheda. */
const GUIDE: Record<Tab, { hint: string; steps: string[] }> = {
  spazi: { hint: "Sale, tavoli, mappa e tipologia interna/esterna", steps: ["Crea una sala e scegli se è Interna o Esterna (dehors).", "Aggiungi i tavoli con posti comodi e massimi: oltre i comodi l'app chiede conferma per i posti scomodi.", "Sblocca la mappa per spostare tavoli, pareti e ostacoli; ribloccala a fine lavoro.", "Usa il calendario della sala per chiuderla in giorni o turni specifici."] },
  orari: { hint: "Turni, chiusure, durata tavolo e meteo", steps: ["Attiva i turni e imposta orari di apertura e ultima prenotazione.", "Indica giorni di chiusura settimanali e festività.", "Durata e cuscinetto regolano la rotazione; il tempo di riassetto vale per gli accomodamenti al volo.", "Inserisci città o coordinate per gli avvisi meteo sui dehors."] },
  regole: { hint: "Priorità e unioni usate dal suggerimento tavoli", steps: ["Le regole base decidono comfort, unioni e prolunghe.", "Scrivi o detta una regola personalizzata: controlla l'anteprima e premi Salva e Applica.", "Le regole orientano il suggerimento ma non bloccano mai una scelta manuale.", "Le abitudini degli ultimi 30 giorni riordinano solo tra i tavoli già sicuri."] },
  integrazioni: { hint: "Prenotazioni online, email e dettatura vocale", steps: ["Attiva il canale online e copia il link o il codice per il sito.", "Configura il servizio email e invia una prova prima di attivare gli invii.", "Personalizza i testi delle email e il promemoria del mattino.", "Per la dettatura inserisci e verifica la chiave del servizio IA."] },
  dati: { hint: "Nome, contatti, logo e testi pubblici", steps: ["Questi dati compaiono nella pagina di prenotazione e nelle email.", "Il logo si inserisce incollando l'indirizzo web di un'immagine.", "Controlla indirizzo e telefono: li vedono i clienti."] },
};
function TabGuide({ tab }: { tab: Tab }) {
  const g = GUIDE[tab];
  return <details className="mb-4 rounded-md border bg-muted/40 p-3 text-sm" open>
    <summary className="flex cursor-pointer items-center gap-2 font-semibold"><CircleHelp className="size-4" /> Mini guida — {g.hint}</summary>
    <ol className="mt-2 list-decimal space-y-1 pl-6 text-muted-foreground">{g.steps.map((x) => <li key={x}>{x}</li>)}</ol>
  </details>;
}
const isTab = (v: unknown): v is Tab => TABS.some(([k]) => k === v);

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => (isTab(s["tab"]) ? { tab: s["tab"] } : {}),
  head: () => ({
    meta: [
      { title: "Configurazione Ristorante — Segnatavolo" },
      { name: "description", content: "Hub riservato Master per spazi, orari, regole sala, integrazioni e dati del ristorante." },
      { property: "og:title", content: "Configurazione Ristorante — Segnatavolo" },
      { property: "og:description", content: "Tutte le impostazioni del ristorante in un unico hub a schede." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RestaurantGate><SettingsPage /></RestaurantGate>,
});

function SettingsPage() {
  const { data: me, isPending } = useMembership();
  const { data: superAdmin, isPending: adminPending } = useIsSuperAdmin();
  const { tab = "spazi" } = Route.useSearch();
  const navigate = useNavigate({ from: "/settings" });
  if (isPending || adminPending) return null;
  if (!me || (me.role !== "master" && !superAdmin)) return <Navigate to="/agenda" />;
  const settings = me.restaurants?.settings;
  return (
    <main className="min-h-screen w-full bg-background px-3 py-6 sm:px-6 lg:px-8">
      <Button asChild variant="outline" className="mb-6"><Link to="/agenda"><ArrowLeft /> Agenda</Link></Button>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b pb-6">
        <div><p className="mb-2 text-sm text-muted-foreground">{me.restaurants?.name}</p><h1 className="font-display text-3xl">Configurazione Ristorante</h1></div>
        <span className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="size-4" /> Riservato Master</span>
      </div>
      <Tabs value={tab} onValueChange={(v) => isTab(v) && navigate({ search: { tab: v }, replace: true })} orientation="vertical" className="flex flex-col gap-6 lg:flex-row">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 lg:sticky lg:top-4 lg:w-60 lg:shrink-0 lg:flex-col lg:items-stretch lg:self-start">
          {TABS.map(([k, label]) => <TabsTrigger key={k} value={k} title={GUIDE[k].hint} className="justify-start px-3 py-2">{label}</TabsTrigger>)}
        </TabsList>
        <div className="min-w-0 flex-1">
          <TabsContent value="spazi" className="mt-0"><TabGuide tab="spazi" /><SpacesEditor embedded /></TabsContent>
          <TabsContent value="orari" className="mt-0 max-w-3xl"><TabGuide tab="orari" /><ServiceSettingsForm id={me.restaurant_id} settings={settings} walkinBuffer={me.restaurants?.tempo_riassetto_minuti ?? 5} /></TabsContent>
          <TabsContent value="regole" className="mt-0 max-w-4xl"><TabGuide tab="regole" /><AssignmentRulesEditor /></TabsContent>
          <TabsContent value="integrazioni" className="mt-0 max-w-3xl"><TabGuide tab="integrazioni" /><OnlineBookingSettings id={me.restaurant_id} name={me.restaurants?.name ?? ""} /></TabsContent>
          <TabsContent value="dati" className="mt-0 max-w-3xl"><TabGuide tab="dati" /><RestaurantProfileForm id={me.restaurant_id} name={me.restaurants?.name ?? ""} settings={settings} /></TabsContent>
        </div>
      </Tabs>
    </main>
  );
}
