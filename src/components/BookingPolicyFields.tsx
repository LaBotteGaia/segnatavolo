import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { WEEKDAYS, type BookingPolicy } from '@/lib/booking-policy';

export function BookingPolicyFields({ value, onChange }: { value: BookingPolicy; onChange: (patch: Partial<BookingPolicy>) => void }) {
  return <fieldset className="space-y-4 border-t pt-4">
    <legend className="font-display text-lg">Informazioni e riconferma online</legend>
    <label className="block text-sm">Introduzione sulla sala e capienza<Textarea value={value.custom_intro_text} maxLength={5000} onChange={e => onChange({ custom_intro_text: e.target.value })}/></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Telefono prenotazioni e lista d’attesa<Input type="tel" value={value.contact_phone} maxLength={40} onChange={e => onChange({ contact_phone: e.target.value })}/></label>
      <label className="text-sm">WhatsApp riconferme<Input type="tel" value={value.contact_whatsapp} maxLength={40} onChange={e => onChange({ contact_whatsapp: e.target.value })}/></label>
      <label className="text-sm">Fuso orario<Input value={value.timezone} maxLength={100} onChange={e => onChange({ timezone: e.target.value })}/></label>
      <label className="text-sm">Tolleranza ritardo non comunicato (minuti)<NumberInput min={0} max={120} defaultValue={15} value={value.no_show_tolerance_minutes} onCommit={no_show_tolerance_minutes => onChange({ no_show_tolerance_minutes })}/></label>
    </div>
    <label className="flex items-center justify-between gap-3 text-sm">Consenti prenotazioni del giorno stesso<Switch checked={value.allow_same_day_online} onCheckedChange={allow_same_day_online => onChange({ allow_same_day_online })}/></label>
    <label className="flex items-center justify-between gap-3 text-sm">Promemoria mattutino dalle 09:00<Switch checked={value.morning_reminder_enabled} onCheckedChange={morning_reminder_enabled => onChange({ morning_reminder_enabled })}/></label>
    <label className="flex items-center justify-between gap-3 text-sm">Doppio turno online del ristorante<Switch checked={value.enable_double_shift} onCheckedChange={enable_double_shift => onChange({ enable_double_shift })}/></label>
    {value.enable_double_shift && <>
      <div className="flex flex-wrap gap-3">{WEEKDAYS.map(day => <label key={day} className="flex items-center gap-2 text-sm"><Checkbox checked={value.double_shift_days.includes(day)} onCheckedChange={checked => onChange({ double_shift_days: checked ? [...value.double_shift_days, day] : value.double_shift_days.filter(d => d !== day) })}/>{day}</label>)}</div>
      <label className="block text-sm">Durata primo turno (minuti)<NumberInput min={15} max={480} defaultValue={90} value={value.first_shift_duration_minutes} onCommit={first_shift_duration_minutes => onChange({ first_shift_duration_minutes })}/></label>
    </>}
  </fieldset>;
}