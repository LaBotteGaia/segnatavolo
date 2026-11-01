import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { identitySchema } from "@/lib/restaurant-identity";
import { FieldHelp } from "./FieldHelp";
import type { Tables } from "@/integrations/supabase/types";
import { configurationError } from "@/lib/assignment-rules";

export type RestaurantProfile = { logoUrl: string; phone: string; email: string; address: string; website: string; vat: string };
const EMPTY: RestaurantProfile = { logoUrl: "", phone: "", email: "", address: "", website: "", vat: "" };

export function profileOf(settings: unknown): RestaurantProfile {
  const p = settings && typeof settings === "object" ? (settings as { profile?: unknown }).profile : undefined;
  if (!p || typeof p !== "object") return { ...EMPTY };
  const o = p as Record<string, unknown>;
  return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, typeof o[k] === "string" ? (o[k] as string).slice(0, 500) : ""])) as RestaurantProfile;
}

/** All fields are persisted on the restaurant itself. */
export function RestaurantProfileForm({ id }: { id: string; name: string; settings: unknown }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['restaurant-identity', id], queryFn: async () => { const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).single(); if (error) throw error; return data; } });
  if (query.isError) return <p role="alert">Anagrafica non disponibile.</p>;
  if (!query.data) return null;
  return <IdentityForm key={`${id}-${query.data.name}`} initial={query.data} onSaved={() => { void qc.invalidateQueries({ queryKey: ['restaurant-identity', id] }); void qc.invalidateQueries({ queryKey: ['membership'] }); void qc.invalidateQueries({ queryKey: ['online-settings', id] }); }} />;
}
function IdentityForm({ initial, onSaved }: { initial: Tables<'restaurants'>; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => identitySchema.parse(initial)); const [saving, setSaving] = useState(false);
  const fields = [['name', 'Nome del ristorante', 'Nome riportato in agenda, pagina pubblica e comunicazioni.'], ['public_logo_url', 'Logo (URL HTTPS)', 'Immagine del locale condivisa da tutti i moduli.'], ['public_address', 'Indirizzo', 'Indirizzo mostrato ai clienti e usato come riferimento meteo.'], ['main_phone', 'Telefono principale', 'Recapito ereditato dalle prenotazioni online, salvo override.'], ['main_whatsapp', 'WhatsApp principale', 'Numero WhatsApp ereditato dal flusso online.'], ['main_email', 'Email principale', 'Riceve le notifiche del locale, salvo email dedicata.'], ['website_url', 'Sito web', 'Sito ufficiale del ristorante.'], ['vat_number', 'Partita IVA', 'Dati fiscali del ristorante.'], ['timezone', 'Fuso orario', 'Regola date, avvisi e riepilogo mattutino; predefinito Europe/Rome.']] as const;
  return <form className="space-y-4" onSubmit={async e => { e.preventDefault(); const valid = identitySchema.safeParse(draft); if (!valid.success) { toast.error(valid.error.issues[0]?.message ?? 'Controlla i dati'); return; } setSaving(true); try { const { error } = await supabase.from('restaurants').update(valid.data).eq('id', initial.id); if (error) throw error; toast.success('Dati del ristorante salvati'); onSaved(); } catch { toast.error('Anagrafica non salvata'); } finally { setSaving(false); } }}>
    {draft.public_logo_url && <img src={draft.public_logo_url} alt="Logo del ristorante" className="size-20 rounded-md border object-contain" />}
    <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label, help]) => <div key={key}><Label htmlFor={`identity-${key}`}>{label}</Label><Input id={`identity-${key}`} type={key === 'main_email' ? 'email' : 'text'} value={draft[key]} onChange={e => setDraft(current => ({ ...current, [key]: e.target.value }))} /><FieldHelp>{help}</FieldHelp></div>)}</div>
    <Button type="submit" disabled={saving}>Salva dati ristorante</Button>
  </form>;
}
