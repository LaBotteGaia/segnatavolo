import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Switch } from '@/components/ui/switch';
import { geocodeCity, type WeatherSettings } from '@/services/weatherService';

export function WeatherSettingsFields({ value, onChange }: { value: WeatherSettings; onChange: (v:WeatherSettings)=>void }) {
  const [busy,setBusy] = useState(false);
  const locate = async () => {
    setBusy(true);
    try { const p = await geocodeCity(value.city); onChange({...value,latitude:p.latitude,longitude:p.longitude}); toast.success(`Coordinate di ${p.name} trovate`); }
    catch(e) { toast.error(e instanceof Error ? e.message : 'Città non trovata'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 border-t pt-4">
    <h3 className="font-display text-lg">Meteo e dehors</h3>
    <label className="block text-sm">Città del ristorante<Input value={value.city} onChange={e=>onChange({...value,city:e.target.value})} aria-label="Città del ristorante" /></label>
    <Button type="button" variant="outline" disabled={busy || !value.city.trim()} onClick={locate}>{busy?'Ricerca…':'Trova coordinate della città'}</Button>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-sm">Latitudine GPS<Input type="number" min={-90} max={90} step="any" value={value.latitude ?? ''} onChange={e=>onChange({...value,latitude:e.target.value===''?null:Number(e.target.value)})} aria-label="Latitudine GPS" /></label>
      <label className="text-sm">Longitudine GPS<Input type="number" min={-180} max={180} step="any" value={value.longitude ?? ''} onChange={e=>onChange({...value,longitude:e.target.value===''?null:Number(e.target.value)})} aria-label="Longitudine GPS" /></label>
      <label className="text-sm">Temperatura minima (°C)<NumberInput value={value.minTemperature} min={-30} max={50} onCommit={n=>onChange({...value,minTemperature:n})} aria-label="Temperatura minima meteo" /></label>
      <label className="text-sm">Temperatura massima pranzo (°C)<NumberInput value={value.maxTemperature} min={-30} max={50} onCommit={n=>onChange({...value,maxTemperature:n})} aria-label="Temperatura massima meteo" /></label>
    </div>
    <label className="flex items-center justify-between gap-2 text-sm">Dehors riscaldato<Switch checked={value.heated} onCheckedChange={heated=>onChange({...value,heated})} /></label>
    <label className="flex items-center justify-between gap-2 text-sm">Dehors riparato dal sole<Switch checked={value.shaded} onCheckedChange={shaded=>onChange({...value,shaded})} /></label>
  </section>;
}