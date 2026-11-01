import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WeatherSettingsFields } from './WeatherSettingsFields';
import { weatherSettingsOf } from '@/services/weatherService';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
export function WeatherIntegrationForm({ id, settings }: { id: string; settings: unknown }) {
  const [weather, setWeather] = useState(() => weatherSettingsOf(settings)); const [busy, setBusy] = useState(false); const qc = useQueryClient();
  useEffect(() => setWeather(weatherSettingsOf(settings)), [settings]);
  return <form className="space-y-4" onSubmit={async e => { e.preventDefault(); if (weather.minTemperature >= weather.maxTemperature || (weather.latitude === null) !== (weather.longitude === null)) { toast.error('Controlla coordinate e temperature'); return; } setBusy(true); try { const { data, error } = await supabase.from('restaurants').select('settings').eq('id', id).single(); if (error) throw error; const current = data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings) ? data.settings : {}; const saved = await supabase.from('restaurants').update({ settings: { ...current, weather } }).eq('id', id); if (saved.error) throw saved.error; await qc.invalidateQueries({ queryKey: ['membership'] }); toast.success('Meteo aggiornato'); } catch { toast.error('Meteo non salvato'); } finally { setBusy(false); } }}><WeatherSettingsFields value={weather} onChange={setWeather} /><Button disabled={busy}>Salva meteo</Button></form>;
}