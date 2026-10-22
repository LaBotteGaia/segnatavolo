import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AI_PROVIDERS, type AiProvider } from "@/lib/voice-ai";
import { getAiSettings, saveAiSettings, testAiKey } from "@/lib/voice-ai.functions";

export function AiVoiceSettings({ id }: { id: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getAiSettings), save = useServerFn(saveAiSettings), test = useServerFn(testAiKey);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  useEffect(() => { load({ data: { id } }).then((r) => { setEnabled(r.enabled); setProvider(r.provider); setSaved(r.keySaved); }).catch(() => toast.error("Impostazioni IA non disponibili")); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSave = async () => {
    if (enabled && !saved && !key.trim()) { toast.error("Inserisci la chiave API prima di abilitare la dettatura"); return; }
    setBusy("save");
    try { await save({ data: { id, settings: { enabled, provider }, key } }); if (key.trim()) setSaved(true); setKey(""); toast.success("Integrazione IA salvata"); qc.invalidateQueries({ queryKey: ["ai-settings"] }); }
    catch { toast.error("Salvataggio non riuscito"); } finally { setBusy(""); }
  };
  const onTest = async () => {
    setBusy("test");
    try { const r = await test({ data: { id, provider, key } }); r.ok ? toast.success(r.message) : toast.error(r.message); }
    catch { toast.error("Verifica non riuscita"); } finally { setBusy(""); }
  };

  return (
    <section className="space-y-3 rounded-md border p-3">
      <h3 className="font-display text-lg">Integrazione IA &amp; Dettatura Vocale</h3>
      <label className="flex items-center justify-between gap-3 text-sm font-semibold">Abilita Dettatura Vocale con IA <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Abilita Dettatura Vocale con IA" /></label>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((p) => (
          <button key={p} type="button" onClick={() => setProvider(p)} className={`rounded px-2 py-2 text-xs font-semibold ${provider === p ? "bg-paper text-primary shadow-sm" : "text-muted-foreground"}`}>{AI_PROVIDERS[p]}</button>
        ))}
      </div>
      <label className="block text-sm">Chiave API (API Key)
        <div className="relative mt-1">
          <Input type={show ? "text" : "password"} autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={saved ? "•••••• chiave salvata (lascia vuoto per mantenerla)" : provider === "openai" ? "sk-..." : "AIza..."} className="pr-10" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={show ? "Nascondi chiave" : "Mostra chiave"}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
        </div>
      </label>
      <p className="text-xs text-muted-foreground">La chiave viene cifrata e usata solo per questo ristorante; non è mai visibile allo staff.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={!!busy} onClick={onTest}>{busy === "test" && <Loader2 className="animate-spin" />}Verifica chiave / Test connessione</Button>
        <Button type="button" disabled={!!busy} onClick={onSave}>{busy === "save" && <Loader2 className="animate-spin" />}Salva integrazione IA</Button>
      </div>
    </section>
  );
}
