import type { Shift } from '@/lib/data';

export type WeatherSettings = { latitude: number | null; longitude: number | null; city: string; minTemperature: number; maxTemperature: number; heated: boolean; shaded: boolean };
export const DEFAULT_WEATHER: WeatherSettings = { latitude: null, longitude: null, city: '', minTemperature: 15, maxTemperature: 34, heated: false, shaded: false };
export function weatherSettingsOf(settings: unknown): WeatherSettings {
  const raw = (settings && typeof settings === 'object' ? (settings as { weather?: unknown }).weather : null);
  const o = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const number = (k: string, fallback: number | null) => typeof o[k] === 'number' && Number.isFinite(o[k]) ? o[k] as number : fallback;
  return { latitude: number('latitude', null), longitude: number('longitude', null), city: typeof o.city === 'string' ? o.city : '', minTemperature: number('minTemperature', 15) ?? 15, maxTemperature: number('maxTemperature', 34) ?? 34, heated: o.heated === true, shaded: o.shaded === true };
}
export type WeatherHour = { time: string; temperature: number; probability: number; precipitation: number; code: number; wind: number; gust: number };
export function serviceWeather(hours: WeatherHour[], date: string, shift: Shift, settings: WeatherSettings) {
  const [from, to] = shift === 'pranzo' ? ['12:00', '15:00'] : shift === 'sera' ? ['19:30', '23:30'] : ['07:30', '10:30'];
  const selected = hours.filter(h => h.time.slice(0, 10) === date && h.time.slice(11, 16) >= from && h.time.slice(11, 16) <= to);
  if (!selected.length) return null;
  const temperature = selected.reduce((n, h) => n + h.temperature, 0) / selected.length;
  const rain = selected.some(h => h.precipitation > 0.5 || h.code >= 51);
  const wind = selected.some(h => Math.max(h.wind, h.gust) > 35);
  const cold = !settings.heated && temperature < settings.minTemperature;
  const hot = shift === 'pranzo' && !settings.shaded && selected.some(h => h.temperature > settings.maxTemperature);
  const reasons = [rain ? 'Pioggia o neve prevista' : '', wind ? 'Vento forte' : '', cold ? 'Freddo eccessivo' : '', hot ? 'Caldo eccessivo' : ''].filter(Boolean);
  const snow = selected.some(h => [71,73,75,77,85,86].includes(h.code));
  const icon = wind ? '💨' : snow ? '❄️' : rain ? '🌧️' : selected.some(h => h.code > 0) ? '⛅' : '☀️';
  return { hours: selected, temperature, reasons, critical: reasons.length > 0, icon };
}
export async function geocodeCity(city: string, signal?: AbortSignal) {
  if (!city.trim()) throw new Error('Imposta la città o le coordinate del ristorante in Orari & Turni.');
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: city.trim(), count: '1', language: 'it', countryCode: 'IT' })}`, { signal });
  if (!response.ok) throw new Error('Ricerca della città non disponibile.');
  const body = await response.json() as { results?: { latitude: number; longitude: number; name: string }[] };
  const place = body.results?.[0];
  if (!place) throw new Error('Città non trovata: inserisci le coordinate GPS.');
  return place;
}
export async function fetchWeather(settings: WeatherSettings, date: string, signal?: AbortSignal): Promise<WeatherHour[]> {
  const coords = settings.latitude !== null && settings.longitude !== null ? settings : await geocodeCity(settings.city, signal);
  const query = new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude), start_date: date, end_date: date, timezone: 'Europe/Rome', hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m', wind_speed_unit: 'kmh' });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal });
  if (!response.ok) throw new Error('Previsioni non disponibili per questa data (fino a 16 giorni).');
  const body = await response.json() as { hourly?: Record<string, (number | string | null)[]> };
  const h = body.hourly;
  if (!h?.time) throw new Error('Previsioni non disponibili.');
  return h.time.flatMap((t, i) => {
    const fields = ['temperature_2m','precipitation_probability','precipitation','weather_code','wind_speed_10m','wind_gusts_10m'].map(k => h[k]?.[i]);
    if (typeof t !== 'string' || fields.some(v => typeof v !== 'number' || !Number.isFinite(v))) return [];
    const [temperature, probability, precipitation, code, wind, gust] = fields as number[];
    if (temperature === undefined || probability === undefined || precipitation === undefined || code === undefined || wind === undefined || gust === undefined) return [];
    return [{ time:t,temperature,probability,precipitation,code,wind,gust }];
  });
}