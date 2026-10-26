import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { configurationError } from "@/lib/assignment-rules";

export type RestaurantProfile = { logoUrl: string; phone: string; email: string; address: string; website: string; vat: string };
const EMPTY: RestaurantProfile = { logoUrl: "", phone: "", email: "", address: "", website: "", vat: "" };

export function profileOf(settings: unknown): RestaurantProfile {
  const p = settings && typeof settings === "object" ? (settings as { profile?: unknown }).profile : undefined;
  if (!p || typeof p !== "object") return { ...EMPTY };
  const o = p as Record<string, unknown>;
  return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, typeof o[k] === "string" ? (o[k] as string).slice(0, 500) : ""])) as RestaurantProfile;
}

/** Anagrafica, logo e recapiti, salvati nelle impostazioni del ristorante preservando ogni altra chiave. */
export function RestaurantProfileForm({ id, name, settings }: { id: string; name: string; settings: unknown }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(name);
  const [p, setP] = useState<RestaurantProfile>(() => profileOf(settings));
  useEffect(() => { setValue(name); setP(profileOf(settings)); }, [name, settings]);
  const set = (k: keyof RestaurantProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP((o) => ({ ...o, [k]: e.target.value }));
  const logoOk = !p.logoUrl || /^https:\/\//.test(p.logoUrl);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) { toast.error("Inserisci il nome del ristorante"); return; }
    if (!logoOk) { toast.error("Il logo deve essere un indirizzo https://"); return; }
    const preserved = settings && typeof settings === "object" ? settings : {};
    const { data, error } = await supabase.from("restaurants").update({ name: value.trim(), settings: { ...preserved, profile: p } }).eq("id", id).select("id");
    if (error || !data?.length) { toast.error(configurationError(error ?? { code: "42501" })); return; }
    toast.success("Dati del ristorante salvati");
    qc.invalidateQueries({ queryKey: ["membership"] });
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <div><Label htmlFor="rp-name">Nome del ristorante</Label><Input id="rp-name" value={value} onChange={(e) => setValue(e.target.value)} /></div>
      <div className="flex items-start gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-paper">
          {p.logoUrl && logoOk ? <img src={p.logoUrl} alt="Logo del ristorante" className="size-full object-contain" /> : <span className="text-xs text-muted-foreground">Logo</span>}
        </div>
        <div className="flex-1"><Label htmlFor="rp-logo">Indirizzo immagine del logo</Label><Input id="rp-logo" placeholder="https://..." value={p.logoUrl} onChange={set("logoUrl")} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="rp-phone">Telefono</Label><Input id="rp-phone" type="tel" value={p.phone} onChange={set("phone")} /></div>
        <div><Label htmlFor="rp-email">Email</Label><Input id="rp-email" type="email" value={p.email} onChange={set("email")} /></div>
        <div><Label htmlFor="rp-web">Sito web</Label><Input id="rp-web" value={p.website} onChange={set("website")} /></div>
        <div><Label htmlFor="rp-vat">Partita IVA</Label><Input id="rp-vat" value={p.vat} onChange={set("vat")} /></div>
      </div>
      <div><Label htmlFor="rp-addr">Indirizzo</Label><Textarea id="rp-addr" rows={2} value={p.address} onChange={set("address")} /></div>
      <Button type="submit" className="w-full">Salva dati ristorante</Button>
    </form>
  );
}
