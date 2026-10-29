import { describe, expect, it } from 'vitest';
import { DEFAULT_WEATHER, serviceWeather, type WeatherHour } from '../services/weatherService';
const hour = (time = '12:00', patch: Partial<WeatherHour> = {}): WeatherHour => ({ time:`2026-10-29T${time}`, temperature:20, probability:10, precipitation:0, code:0, wind:5, gust:10, ...patch });
const check = (hours: WeatherHour[], shift: 'pranzo' | 'sera' = 'pranzo', settings = DEFAULT_WEATHER) => serviceWeather(hours, '2026-10-29', shift, settings);
describe('Meteo turno', () => {
  it('pranzo solo 12–15, estremi inclusi', () => expect(check([hour('11:00'),hour(),hour('15:00'),hour('16:00')])?.hours).toHaveLength(2));
  it('cena solo 19:30–23:30', () => expect(check([hour('19:00'),hour('20:00'),hour('23:00'),hour('00:00')], 'sera')?.hours).toHaveLength(2));
  it('ignora altre date', () => expect(check([hour('12:00', {time:'2026-10-30T12:00'})])).toBeNull());
  it('precipitazione strettamente oltre 0,5', () => { expect(check([hour('12:00',{precipitation:0.5})])?.critical).toBe(false); expect(check([hour('12:00',{precipitation:0.6})])?.critical).toBe(true); });
  it('codice 51 allerta', () => expect(check([hour('12:00',{code:51})])?.critical).toBe(true));
  it('vento o raffiche oltre 35 km/h', () => { expect(check([hour('12:00',{wind:35,gust:35})])?.critical).toBe(false); expect(check([hour('12:00',{wind:36})])?.critical).toBe(true); expect(check([hour('12:00',{gust:36})])?.critical).toBe(true); });
  it('freddo medio sotto 15 e riscaldamento', () => { expect(check([hour('12:00',{temperature:14})])?.critical).toBe(true); expect(check([hour('12:00',{temperature:15})])?.critical).toBe(false); expect(check([hour('12:00',{temperature:14})],'pranzo',{...DEFAULT_WEATHER,heated:true})?.critical).toBe(false); });
  it('caldo oltre 34 solo pranzo esposto', () => { expect(check([hour('12:00',{temperature:35})])?.critical).toBe(true); expect(check([hour('20:00',{temperature:35})],'sera')?.critical).toBe(false); expect(check([hour('12:00',{temperature:35})],'pranzo',{...DEFAULT_WEATHER,shaded:true})?.critical).toBe(false); });
  it('rispetta soglie personalizzate', () => expect(check([hour('12:00',{temperature:19})],'pranzo',{...DEFAULT_WEATHER,minTemperature:20})?.critical).toBe(true));
});